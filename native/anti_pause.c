/*
 * anti_pause.dll
 *
 * Features:
 *  1. Window subclassing (primary anti-pause) –
 *     After DLL injection the background thread finds the game's main window
 *     and replaces its WndProc.  Our SubclassWndProc swallows
 *     WM_ACTIVATEAPP(FALSE), WM_ACTIVATE(WA_INACTIVE), WM_KILLFOCUS,
 *     and WM_NCACTIVATE(FALSE) before the game's WndProc ever sees them.
 *
 *  2. WH_CALLWNDPROC + WH_GETMESSAGE hooks –
 *     Used as the injection vehicle (SetWindowsHookEx loads this DLL into
 *     the game process automatically) and as an extra belt-and-suspenders
 *     layer that modifies wParam in-place for sent/posted activate messages.
 *
 *  3. IDXGISwapChain::Present + IDXGISwapChain1::Present1 vtable hook –
 *     FPS limiter using NtDelayExecution (100 ns resolution) + busy-wait.
 *
 *  4. Named shared memory ("Local\NaizenGame") –
 *     Electron creates it; the injected game DLL reads fg/bg FPS + active flag.
 *
 * Exports (called from Electron via koffi):
 *   BOOL   InstallHook  (DWORD threadId)
 *   void   RemoveHook   (void)
 *   void   CreateConfig (void)
 *   void   SetFps       (float fg, float bg)
 *   void   SetActive    (BOOL active)
 */

#define WIN32_LEAN_AND_MEAN
#define INITGUID
#define COBJMACROS
#include <windows.h>
#include <dxgi1_2.h>
#include <d3d11.h>

/* ── Types ────────────────────────────────────────────────────────────────── */

typedef HRESULT (STDMETHODCALLTYPE *PFN_Present)
    (IDXGISwapChain*, UINT, UINT);
typedef HRESULT (STDMETHODCALLTYPE *PFN_Present1)
    (IDXGISwapChain1*, UINT, UINT, const DXGI_PRESENT_PARAMETERS*);
typedef LONG (__stdcall *PFN_NtDelay)(BOOLEAN alertable, PLARGE_INTEGER interval);

/* ── Shared-Memory layout ─────────────────────────────────────────────────── */

#define SHMEM_NAME L"Local\\NaizenGame"

typedef struct {
    float fg_fps;
    float bg_fps;
    BOOL  active;
} GameConfig;

/* ── Globals ──────────────────────────────────────────────────────────────── */

/* Injection hooks */
static HHOOK g_hook     = NULL;
static HHOOK g_hook_msg = NULL;

/* Window subclass (primary anti-pause) */
static HWND    g_game_hwnd    = NULL;
static WNDPROC g_orig_wndproc = NULL;

/* FPS limiter */
static PFN_Present  g_real_Present  = NULL;
static PFN_Present1 g_real_Present1 = NULL;
static PFN_NtDelay  g_NtDelay       = NULL;

static LARGE_INTEGER g_freq      = {0};
static LARGE_INTEGER g_last_tick = {0};

static void** g_vtable_base  = NULL;
static void*  g_orig_p8      = NULL;
static void** g_vtable1_base = NULL;
static void*  g_orig_p22_v1  = NULL;

/* Shared memory */
static HANDLE     g_shmem = NULL;
static GameConfig *g_cfg  = NULL;

/* ── VTable helpers ───────────────────────────────────────────────────────── */

static void vtable_patch(void** vt, int idx, void* hook, void** orig)
{
    if (vt[idx] == hook) return;
    DWORD old;
    if (VirtualProtect(&vt[idx], sizeof(void*), PAGE_EXECUTE_READWRITE, &old)) {
        if (orig) *orig = vt[idx];
        vt[idx] = hook;
        VirtualProtect(&vt[idx], sizeof(void*), old, &old);
    }
}

static void vtable_restore(void** vt, int idx, void* orig)
{
    if (!vt || !orig) return;
    DWORD old;
    if (VirtualProtect(&vt[idx], sizeof(void*), PAGE_EXECUTE_READWRITE, &old)) {
        vt[idx] = orig;
        VirtualProtect(&vt[idx], sizeof(void*), old, &old);
    }
}

/* ── FPS limiter core ─────────────────────────────────────────────────────── */

static void fps_wait(void)
{
    if (!g_cfg) return;
    float fps = g_cfg->active ? g_cfg->fg_fps : g_cfg->bg_fps;
    if (fps <= 0.0f) return;

    double interval = 1.0 / (double)fps;
    LARGE_INTEGER now;

    for (;;) {
        QueryPerformanceCounter(&now);
        double elapsed = (double)(now.QuadPart - g_last_tick.QuadPart)
                       / (double)g_freq.QuadPart;
        if (elapsed >= interval) break;

        double remain = interval - elapsed;
        if (remain > 0.002 && g_NtDelay) {
            LARGE_INTEGER delay;
            delay.QuadPart = (LONGLONG)((remain - 0.001) * -10000000.0);
            g_NtDelay(FALSE, &delay);
        }
    }
    g_last_tick = now;
}

/* ── Present hooks ────────────────────────────────────────────────────────── */

static HRESULT STDMETHODCALLTYPE Hook_Present(
    IDXGISwapChain *pThis, UINT SyncInterval, UINT Flags)
{
    fps_wait();
    HRESULT hr = g_real_Present(pThis, SyncInterval, Flags);
    /* DXGI_STATUS_OCCLUDED = window is hidden/minimised.
       Return S_OK so the game's render loop keeps running. */
    if (hr == DXGI_STATUS_OCCLUDED) hr = S_OK;
    return hr;
}

static HRESULT STDMETHODCALLTYPE Hook_Present1(
    IDXGISwapChain1 *pThis, UINT SyncInterval, UINT Flags,
    const DXGI_PRESENT_PARAMETERS *pParams)
{
    fps_wait();
    HRESULT hr = g_real_Present1(pThis, SyncInterval, Flags, pParams);
    if (hr == DXGI_STATUS_OCCLUDED) hr = S_OK;
    return hr;
}

/* ── Window subclassing ───────────────────────────────────────────────────── */

/*
 * Our replacement WndProc. Swallows all messages that would cause the game
 * to pause or drop to a lower-priority state when it loses OS focus.
 */
static LRESULT CALLBACK SubclassWndProc(HWND hwnd, UINT msg, WPARAM wp, LPARAM lp)
{
    switch (msg) {
    case WM_ACTIVATEAPP:
        if (!(BOOL)wp) return 0;
        break;

    case WM_ACTIVATE:
        if (LOWORD(wp) == WA_INACTIVE) return 0;
        break;

    case WM_KILLFOCUS:
        return 0;

    case WM_NCACTIVATE:
        if (!(BOOL)wp)
            return CallWindowProcW(g_orig_wndproc, hwnd, msg, TRUE, (LPARAM)-1);
        break;

    case WM_SYSCOMMAND:
        if ((wp & 0xFFF0) == SC_MINIMIZE) {
            /*
             * Let Windows minimise the window visually (taskbar button shown)
             * but don't forward the message to the game's WndProc, so its
             * "I am being minimised" pause logic never fires.
             */
            ShowWindow(hwnd, SW_MINIMIZE);
            return 0;
        }
        break;

    case WM_SIZE:
        if (wp == SIZE_MINIMIZED) {
            /*
             * Window reached minimised state.  Tell the game it is still
             * at the same size as before (SIZE_RESTORED) so it keeps its
             * render loop running.  The lParam (width/height) is unchanged.
             */
            return CallWindowProcW(g_orig_wndproc, hwnd, msg, SIZE_RESTORED, lp);
        }
        break;
    }
    return CallWindowProcW(g_orig_wndproc, hwnd, msg, wp, lp);
}

static BOOL CALLBACK FindMainWindowCb(HWND hwnd, LPARAM unused)
{
    (void)unused;
    if (!IsWindowVisible(hwnd)) return TRUE;
    if (GetWindow(hwnd, GW_OWNER) != NULL) return TRUE; /* skip owned/child */

    DWORD pid = 0;
    GetWindowThreadProcessId(hwnd, &pid);
    if (pid == GetCurrentProcessId()) {
        g_game_hwnd = hwnd;
        return FALSE; /* stop */
    }
    return TRUE;
}

static DWORD WINAPI SubclassThread(LPVOID unused)
{
    (void)unused;
    /* Retry for 30 s — game window may not exist yet when DLL is first loaded */
    for (int i = 0; i < 60 && !g_game_hwnd; i++) {
        Sleep(500);
        EnumWindows(FindMainWindowCb, 0);
    }
    if (g_game_hwnd && !g_orig_wndproc) {
        g_orig_wndproc = (WNDPROC)(LONG_PTR)SetWindowLongPtrW(
            g_game_hwnd, GWLP_WNDPROC, (LONG_PTR)SubclassWndProc);
    }
    return 0;
}

/* ── D3D11 / DXGI setup thread ────────────────────────────────────────────── */

static DWORD WINAPI SetupFpsThread(LPVOID unused)
{
    (void)unused;

    for (int attempt = 0; attempt < 20; attempt++) {
        Sleep(1000);

        HWND hwnd = CreateWindowExW(0, L"STATIC", NULL, WS_POPUP,
                                    0, 0, 1, 1, NULL, NULL, NULL, NULL);
        if (!hwnd) continue;

        DXGI_SWAP_CHAIN_DESC desc = {0};
        desc.BufferCount          = 1;
        desc.BufferDesc.Width     = 1;
        desc.BufferDesc.Height    = 1;
        desc.BufferDesc.Format    = DXGI_FORMAT_R8G8B8A8_UNORM;
        desc.BufferUsage          = DXGI_USAGE_RENDER_TARGET_OUTPUT;
        desc.OutputWindow         = hwnd;
        desc.SampleDesc.Count     = 1;
        desc.Windowed             = TRUE;

        ID3D11Device   *dev = NULL;
        IDXGISwapChain *sc  = NULL;

        HRESULT hr = D3D11CreateDeviceAndSwapChain(
            NULL, D3D_DRIVER_TYPE_HARDWARE, NULL, 0,
            NULL, 0, D3D11_SDK_VERSION,
            &desc, &sc, &dev, NULL, NULL);

        if (SUCCEEDED(hr)) {
            void **vt = *(void ***)sc;
            g_vtable_base = vt;
            vtable_patch(vt, 8, (void *)Hook_Present, &g_orig_p8);

            IDXGISwapChain1 *sc1 = NULL;
            if (SUCCEEDED(sc->lpVtbl->QueryInterface(
                    sc, &IID_IDXGISwapChain1, (void **)&sc1)))
            {
                void **vt1 = *(void ***)sc1;
                g_vtable1_base = vt1;
                vtable_patch(vt1, 22, (void *)Hook_Present1, &g_orig_p22_v1);
                g_real_Present1 = (PFN_Present1)g_orig_p22_v1;
                sc1->lpVtbl->Release(sc1);
            }
            g_real_Present = (PFN_Present)g_orig_p8;

            sc->lpVtbl->Release(sc);
            dev->lpVtbl->Release(dev);
            DestroyWindow(hwnd);
            break;
        }
        DestroyWindow(hwnd);
    }
    return 0;
}

/* ── Anti-pause belt-and-suspenders hook procs ────────────────────────────── */

/*
 * WH_GETMESSAGE — modifies posted activation messages in the queue.
 * This is a fallback; the subclass WndProc handles most cases first.
 */
static LRESULT CALLBACK GetMsgProc(int nCode, WPARAM wParam, LPARAM lParam)
{
    if (nCode == HC_ACTION && wParam == PM_REMOVE) {
        MSG *msg = (MSG *)lParam;
        if (msg->message == WM_ACTIVATEAPP && !msg->wParam)
            msg->wParam = TRUE;
        if (msg->message == WM_ACTIVATE && LOWORD(msg->wParam) == WA_INACTIVE)
            msg->wParam = (msg->wParam & 0xFFFF0000) | WA_ACTIVE;
    }
    return CallNextHookEx(g_hook_msg, nCode, wParam, lParam);
}

/* WH_CALLWNDPROC — modifies sent activation messages */
static LRESULT CALLBACK HookProc(int nCode, WPARAM wParam, LPARAM lParam)
{
    if (nCode == HC_ACTION) {
        CWPSTRUCT *cwp = (CWPSTRUCT *)lParam;
        if (cwp->message == WM_ACTIVATEAPP && !cwp->wParam)
            cwp->wParam = TRUE;
        if (cwp->message == WM_ACTIVATE && LOWORD(cwp->wParam) == WA_INACTIVE)
            cwp->wParam = (cwp->wParam & 0xFFFF0000) | WA_ACTIVE;
    }
    return CallNextHookEx(g_hook, nCode, wParam, lParam);
}

/* ── Shared-memory helpers ────────────────────────────────────────────────── */

static void open_shmem_read(void)
{
    g_shmem = OpenFileMappingW(FILE_MAP_READ, FALSE, SHMEM_NAME);
    if (g_shmem)
        g_cfg = (GameConfig *)MapViewOfFile(g_shmem, FILE_MAP_READ, 0, 0, sizeof(GameConfig));
}

/* ── Exports ─────────────────────────────────────────────────────────────── */

__declspec(dllexport) void CreateConfig(void)
{
    if (g_shmem) return;
    g_shmem = CreateFileMappingW(
        INVALID_HANDLE_VALUE, NULL, PAGE_READWRITE,
        0, (DWORD)sizeof(GameConfig), SHMEM_NAME);
    if (g_shmem)
        g_cfg = (GameConfig *)MapViewOfFile(
            g_shmem, FILE_MAP_WRITE, 0, 0, sizeof(GameConfig));
    if (g_cfg) {
        g_cfg->fg_fps = 0.0f;
        g_cfg->bg_fps = 0.0f;
        g_cfg->active = TRUE;
    }
}

__declspec(dllexport) void SetFps(float fg, float bg)
{
    if (g_cfg) { g_cfg->fg_fps = fg; g_cfg->bg_fps = bg; }
}

__declspec(dllexport) void SetActive(BOOL active)
{
    if (g_cfg) g_cfg->active = active;
}

__declspec(dllexport) BOOL InstallHook(DWORD threadId)
{
    if (g_hook) return TRUE;
    HMODULE hSelf = NULL;
    GetModuleHandleExW(
        GET_MODULE_HANDLE_EX_FLAG_FROM_ADDRESS |
        GET_MODULE_HANDLE_EX_FLAG_UNCHANGED_REFCOUNT,
        (LPCWSTR)HookProc, &hSelf);
    g_hook     = SetWindowsHookExW(WH_CALLWNDPROC, HookProc,   hSelf, threadId);
    g_hook_msg = SetWindowsHookExW(WH_GETMESSAGE,  GetMsgProc, hSelf, threadId);
    return g_hook != NULL || g_hook_msg != NULL;
}

__declspec(dllexport) void RemoveHook(void)
{
    if (g_hook)     { UnhookWindowsHookEx(g_hook);     g_hook     = NULL; }
    if (g_hook_msg) { UnhookWindowsHookEx(g_hook_msg); g_hook_msg = NULL; }

    /* Restore original WndProc when user explicitly stops the tool */
    if (g_game_hwnd && g_orig_wndproc) {
        SetWindowLongPtrW(g_game_hwnd, GWLP_WNDPROC, (LONG_PTR)g_orig_wndproc);
        g_game_hwnd    = NULL;
        g_orig_wndproc = NULL;
    }
}

/* ── DllMain ──────────────────────────────────────────────────────────────── */

BOOL WINAPI DllMain(HINSTANCE hInst, DWORD reason, LPVOID reserved)
{
    (void)reserved;
    switch (reason) {
    case DLL_PROCESS_ATTACH:
        DisableThreadLibraryCalls(hInst);

        QueryPerformanceFrequency(&g_freq);
        QueryPerformanceCounter(&g_last_tick);

        {
            HMODULE ntdll = GetModuleHandleW(L"ntdll.dll");
            if (ntdll)
                g_NtDelay = (PFN_NtDelay)GetProcAddress(ntdll, "NtDelayExecution");
        }

        open_shmem_read();

        /*
         * Only start the subclass thread when we are actually in the game
         * process.  Electron creates the shared-memory segment BEFORE calling
         * InstallHook, so g_cfg is non-NULL here if and only if we were
         * injected by the hook (i.e. we are running inside the game process).
         */
        if (g_cfg) {
            CloseHandle(CreateThread(NULL, 0, SubclassThread, NULL, 0, NULL));
        }

        CloseHandle(CreateThread(NULL, 0, SetupFpsThread, NULL, 0, NULL));
        break;

    case DLL_PROCESS_DETACH:
        vtable_restore(g_vtable_base,  8,  g_orig_p8);
        vtable_restore(g_vtable1_base, 22, g_orig_p22_v1);

        if (g_game_hwnd && g_orig_wndproc) {
            SetWindowLongPtrW(g_game_hwnd, GWLP_WNDPROC, (LONG_PTR)g_orig_wndproc);
            g_game_hwnd    = NULL;
            g_orig_wndproc = NULL;
        }

        if (g_hook)     { UnhookWindowsHookEx(g_hook);     g_hook     = NULL; }
        if (g_hook_msg) { UnhookWindowsHookEx(g_hook_msg); g_hook_msg = NULL; }
        if (g_cfg)   { UnmapViewOfFile(g_cfg);   g_cfg   = NULL; }
        if (g_shmem) { CloseHandle(g_shmem);     g_shmem = NULL; }
        break;
    }
    return TRUE;
}
