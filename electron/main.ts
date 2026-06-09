import { app, BrowserWindow, dialog, ipcMain, Menu, protocol, screen, Tray, shell, globalShortcut } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'fs'
import { spawn } from 'child_process'
import { autoUpdater } from 'electron-updater'
import { IracingBridge } from './iracing'
import * as iniProfiles from './iniProfiles'
import {
  getIracingWindow,
  resizeWindow,
  restoreWindow,
  getDesktopSource,
  processImage,
  makeThumbnail,
  resolveFilename,
  getCaptureDimensions,
  logScreenshotError,
  listScreenshots,
  EXT,
  type ScreenshotConfig,
} from './screenshot'

let win: BrowserWindow | null = null
let tray: Tray | null = null
let closeAction: 'minimize' | 'quit' = 'minimize'

// ─── iRacing + Screenshot state ───────────────────────────────────────────────

const iracing = new IracingBridge()
let takingScreenshot = false
let pendingCapture: { resolve: (buf: Buffer) => void; reject: (e: Error) => void } | null = null
let screenshotHotkeyAccel = ''

// ─── iRacing App Launcher ─────────────────────────────────────────────────────

interface AppEntry {
  id: string
  name: string
  path: string
  args: string
  startHidden: boolean
  startWithSim: boolean
  stopWithSim: boolean
  startWithUi: boolean
  stopWithUi: boolean
  includeInStartAll: boolean
  includeInStopAll: boolean
}

// iRacing process names we watch for auto start/stop triggers
const IRACING_UI_EXE  = 'iracingui.exe'
const IRACING_SIM_EXE = 'iracingsim64dx11.exe'

function basename(p: string): string {
  return p.split(/[\\/]/).pop() ?? p
}

// ─── Process status poller ───────────────────────────────────────────────────
// Detect "running" via the actual OS process list (many apps are launchers that
// exit after spawning the real process). Also drives iRacing auto start/stop.

let watchedApps: AppEntry[] = []
let pollTimer: ReturnType<typeof setInterval> | null = null
let simRunning = false
let uiRunning = false

function pollProcesses() {
  const proc = spawn('tasklist', ['/FO', 'CSV', '/NH'], { stdio: ['ignore', 'pipe', 'ignore'] })
  let out = ''
  proc.stdout.on('data', (d) => { out += d.toString() })
  proc.on('close', () => {
    const names = new Set<string>()
    for (const line of out.split('\n')) {
      const m = line.match(/^"([^"]+)"/)
      if (m) names.add(m[1].toLowerCase())
    }

    // App running status + file existence
    for (const a of watchedApps) {
      const exe = basename(a.path).toLowerCase()
      win?.webContents.send('apps:status', {
        id: a.id,
        running: exe ? names.has(exe) : false,
        exists: a.path ? existsSync(a.path) : false,
      })
    }

    // iRacing dual-process detection → auto start/stop
    const simNow = names.has(IRACING_SIM_EXE)
    const uiNow  = names.has(IRACING_UI_EXE)

    if (simNow && !simRunning) watchedApps.filter((a) => a.startWithSim).forEach(launchApp)
    if (!simNow && simRunning) watchedApps.filter((a) => a.stopWithSim).forEach((a) => killApp(a.id))
    if (uiNow && !uiRunning)   watchedApps.filter((a) => a.startWithUi).forEach(launchApp)
    if (!uiNow && uiRunning)   watchedApps.filter((a) => a.stopWithUi).forEach((a) => killApp(a.id))

    simRunning = simNow
    uiRunning  = uiNow
  })
}

function startPolling() {
  if (pollTimer) return
  pollTimer = setInterval(pollProcesses, 2000)
  pollProcesses()
}

// Fallback for apps that require admin elevation (spawn throws EACCES)
function launchElevated(app_: AppEntry) {
  const parts = [`Start-Process -FilePath '${app_.path.replace(/'/g, "''")}'`]
  if (app_.args.trim()) parts.push(`-ArgumentList '${app_.args.trim().replace(/'/g, "''")}'`)
  if (app_.startHidden) parts.push('-WindowStyle Hidden')
  parts.push('-Verb RunAs')
  spawn('powershell', ['-NoProfile', '-NonInteractive', '-Command', parts.join(' ')], { stdio: 'ignore' })
    .on('exit', (code) => {
      if (code !== 0) win?.webContents.send('apps:error', { id: app_.id, message: 'Launch cancelled or failed (admin required)' })
      setTimeout(pollProcesses, 1500)
    })
}

function launchApp(app_: AppEntry) {
  if (!app_.path || !existsSync(app_.path)) return
  try {
    const args = app_.args.trim() ? app_.args.trim().split(/\s+/) : []
    const proc = spawn(app_.path, args, {
      detached: true,
      stdio: 'ignore',
      windowsHide: app_.startHidden,
    })
    proc.unref()
    proc.on('error', (e: NodeJS.ErrnoException) => {
      if (e.code === 'EACCES') { launchElevated(app_); return }  // needs elevation
      console.error(`[apps] ${app_.path}:`, e.message)
      win?.webContents.send('apps:error', { id: app_.id, message: e.message })
    })
    setTimeout(pollProcesses, 1500)
  } catch (e) {
    console.error(`[apps] failed to launch ${app_.path}:`, e)
  }
}

function killApp(id: string) {
  const entry = watchedApps.find((w) => w.id === id)
  if (!entry?.path) return
  const exe = basename(entry.path)
  spawn('taskkill', ['/IM', exe, '/F', '/T'], { stdio: 'ignore' })
    .on('exit', (code) => {
      if (code !== 0) {
        spawn('powershell', ['-NoProfile', '-NonInteractive', '-Command',
          `Start-Process taskkill -ArgumentList '/IM','${exe}','/F','/T' -Verb RunAs`], { stdio: 'ignore' })
      }
      setTimeout(pollProcesses, 1000)
    })
  win?.webContents.send('apps:status', { id, running: false, exists: existsSync(entry.path) })
}

function killAllApps() {
  for (const a of watchedApps) killApp(a.id)
}

// ─── Monitor Resolution ───────────────────────────────────────────────────────

// ─── Monitor Resolution (koffi + user32.dll, Buffer-based) ───────────────────

// sizeof(DISPLAY_DEVICEW) = 840, sizeof(DEVMODEW) = 220
const _DD_SIZE = 840
const _DM_SIZE = 220

// DISPLAY_DEVICEW field offsets
const _DD_CB    = 0    // uint32
const _DD_NAME  = 4    // wchar[32]  = 64 bytes
const _DD_STR   = 68   // wchar[128] = 256 bytes
const _DD_FLAGS = 324  // uint32

// DEVMODEW field offsets
const _DM_SIZE_F = 68   // uint16  (dmSize)
const _DM_FIELDS = 72   // uint32  (dmFields)
const _DM_POSX   = 76   // int32   (dmPosition.x)
const _DM_POSY   = 80   // int32   (dmPosition.y)
const _DM_PELW   = 172  // uint32  (dmPelsWidth)
const _DM_PELH   = 176  // uint32  (dmPelsHeight)
const _DM_FREQ   = 184  // uint32  (dmDisplayFrequency)

let _monitorApiReady = false
let _enumDisplayDevicesW: ((dev: string | null, n: number, buf: Buffer, flags: number) => boolean) | null = null
let _enumDisplaySettingsW: ((dev: string, n: number, buf: Buffer) => boolean) | null = null
let _changeDisplaySettingsExW: ((dev: string, buf: Buffer, hwnd: number, flags: number, lp: number) => number) | null = null

function readWStr(buf: Buffer, offset: number, maxChars: number): string {
  let s = ''
  for (let i = 0; i < maxChars; i++) {
    const c = buf.readUInt16LE(offset + i * 2)
    if (c === 0) break
    s += String.fromCharCode(c)
  }
  return s
}

function loadMonitorApi() {
  if (_monitorApiReady) return
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const koffi = require('koffi') as typeof import('koffi')
  const u32 = koffi.load('user32.dll')
  _enumDisplayDevicesW    = u32.func('bool   __stdcall EnumDisplayDevicesW(str16 lpDevice, uint32 iDevNum, void *lpdd, uint32 dwFlags)') as typeof _enumDisplayDevicesW
  _enumDisplaySettingsW   = u32.func('bool   __stdcall EnumDisplaySettingsW(str16 deviceName, uint32 iModeNum, void *lpDevMode)') as typeof _enumDisplaySettingsW
  _changeDisplaySettingsExW = u32.func('int32 __stdcall ChangeDisplaySettingsExW(str16 lpDevice, void *lpDevMode, intptr hwnd, uint32 dwflags, intptr lParam)') as typeof _changeDisplaySettingsExW
  _monitorApiReady = true
}

function monitorList(): Promise<{ name: string; label: string; modes: { width: number; height: number; hz: number }[] }[]> {
  return new Promise((resolve) => {
    try {
      loadMonitorApi()
      const result: { name: string; label: string; modes: { width: number; height: number; hz: number }[] }[] = []

      for (let i = 0; ; i++) {
        const dd = Buffer.alloc(_DD_SIZE, 0)
        dd.writeUInt32LE(_DD_SIZE, _DD_CB)
        if (!_enumDisplayDevicesW!(null, i, dd, 0)) break
        if (!(dd.readUInt32LE(_DD_FLAGS) & 1)) continue  // DISPLAY_DEVICE_ACTIVE

        const name = readWStr(dd, _DD_NAME, 32)

        // Second call with adapter name → gets attached monitor's friendly name
        let label = readWStr(dd, _DD_STR, 128)
        const mon = Buffer.alloc(_DD_SIZE, 0)
        mon.writeUInt32LE(_DD_SIZE, _DD_CB)
        if (_enumDisplayDevicesW!(name, 0, mon, 0)) {
          const monLabel = readWStr(mon, _DD_STR, 128)
          if (monLabel) label = monLabel
        }

        const modes: { width: number; height: number; hz: number }[] = []
        const seen = new Set<string>()

        for (let j = 0; ; j++) {
          const dm = Buffer.alloc(_DM_SIZE, 0)
          dm.writeUInt16LE(_DM_SIZE, _DM_SIZE_F)
          if (!_enumDisplaySettingsW!(name, j, dm)) break
          const w  = dm.readUInt32LE(_DM_PELW)
          const h  = dm.readUInt32LE(_DM_PELH)
          const hz = dm.readUInt32LE(_DM_FREQ)
          const key = `${w}x${h}x${hz}`
          if (w > 0 && !seen.has(key)) { seen.add(key); modes.push({ width: w, height: h, hz }) }
        }

        // Fetch current position + resolution (ENUM_CURRENT_SETTINGS = 0xFFFFFFFF)
        const cur = Buffer.alloc(_DM_SIZE, 0)
        cur.writeUInt16LE(_DM_SIZE, _DM_SIZE_F)
        let cx = 0, cy = 0, cw = 0, ch = 0
        let chz = 0
        if (_enumDisplaySettingsW!(name, 0xFFFFFFFF, cur)) {
          cx  = cur.readInt32LE(_DM_POSX)
          cy  = cur.readInt32LE(_DM_POSY)
          cw  = cur.readUInt32LE(_DM_PELW)
          ch  = cur.readUInt32LE(_DM_PELH)
          chz = cur.readUInt32LE(_DM_FREQ)
        }

        result.push({ name, label, x: cx, y: cy, width: cw, height: ch, hz: chz, modes })
      }
      resolve(result)
    } catch (e) {
      console.error('[monitor] list error:', e)
      resolve([])
    }
  })
}

async function setMonitorResolution(deviceName: string, width: number, height: number, hz: number): Promise<number> {
  try {
    loadMonitorApi()
    const dm = Buffer.alloc(_DM_SIZE, 0)
    dm.writeUInt16LE(_DM_SIZE, _DM_SIZE_F)
    dm.writeUInt32LE(0x80000 | 0x100000 | 0x400000, _DM_FIELDS)  // DM_PELSWIDTH | DM_PELSHEIGHT | DM_DISPLAYFREQUENCY
    dm.writeUInt32LE(width,  _DM_PELW)
    dm.writeUInt32LE(height, _DM_PELH)
    dm.writeUInt32LE(hz,     _DM_FREQ)
    return _changeDisplaySettingsExW!(deviceName, dm, 0, 0, 0)
  } catch (e) {
    console.error('[monitor] setResolution error:', e)
    return -1
  }
}

// ─── Window State ─────────────────────────────────────────────────────────────

interface WinState { width: number; height: number; x: number; y: number; maximized: boolean }

const DEFAULT_WIN: WinState = { width: 1280, height: 720, x: -1, y: -1, maximized: false }

function winStatePath() {
  return join(app.getPath('userData'), 'window-state.json')
}

function loadWinState(): WinState {
  try {
    const raw = JSON.parse(readFileSync(winStatePath(), 'utf-8')) as WinState
    // Validate that the saved position is still on a connected display
    const onScreen = screen.getAllDisplays().some((d) => {
      const b = d.bounds
      return raw.x >= b.x && raw.y >= b.y &&
             raw.x < b.x + b.width && raw.y < b.y + b.height
    })
    return onScreen ? raw : { ...DEFAULT_WIN }
  } catch {
    return { ...DEFAULT_WIN }
  }
}

function saveWinState() {
  if (!win) return
  const maximized = win.isMaximized()
  const { x, y, width, height } = maximized ? win.getNormalBounds() : win.getBounds()
  writeFileSync(winStatePath(), JSON.stringify({ width, height, x, y, maximized }))
}

// ─── Automation-State ────────────────────────────────────────────────────────
const stopFlags: Record<string, boolean> = {
  afk: true,
  whold: true,
  clicker: true,
  autokey: true,
}

let nutKeyboard: typeof import('@nut-tree-fork/nut-js').keyboard | null = null
let nutMouse: typeof import('@nut-tree-fork/nut-js').mouse | null = null
let nutKey: typeof import('@nut-tree-fork/nut-js').Key | null = null
let uiohook: typeof import('uiohook-napi') | null = null
let winManager: typeof import('node-window-manager') | null = null

// ─── Hotkeys ─────────────────────────────────────────────────────────────────

const hotkeyToolMap = new Map<string, string>() // accelerator → tool

function uiohookToAccelerator(raw: string): string | null {
  if (/^F\d{1,2}$/.test(raw)) return raw
  if (/^Key[A-Z]$/.test(raw)) return raw.slice(3)
  if (/^Digit\d$/.test(raw)) return raw.slice(5)
  if (/^Numpad\d$/.test(raw)) return `num${raw.slice(6)}`
  const map: Record<string, string> = {
    Escape: 'Escape', Space: 'Space', Tab: 'Tab',
    Enter: 'Return', Backspace: 'Backspace', Delete: 'Delete',
    Insert: 'Insert', Home: 'Home', End: 'End',
    PageUp: 'PageUp', PageDown: 'PageDown',
    ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right',
  }
  return map[raw] ?? null
}

function registerHotkey(tool: string, raw: string) {
  for (const [accel, t] of hotkeyToolMap) {
    if (t === tool) { globalShortcut.unregister(accel); hotkeyToolMap.delete(accel); break }
  }
  const accel = uiohookToAccelerator(raw)
  if (!accel) return
  try {
    const ok = globalShortcut.register(accel, () => {
      win?.webContents.send('hotkey:trigger', { tool })
    })
    if (ok) hotkeyToolMap.set(accel, tool)
  } catch { /* ungültiger Accelerator */ }
}

function unregisterHotkey(tool: string) {
  for (const [accel, t] of hotkeyToolMap) {
    if (t === tool) { globalShortcut.unregister(accel); hotkeyToolMap.delete(accel); break }
  }
}

// ─── Anti-Pause + FPS Limiter (anti_pause.dll via koffi) ─────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let fnInstallHook:              ((threadId: number) => boolean) | null = null
let fnRemoveHook:               (() => void) | null = null
let fnCreateConfig:             (() => void) | null = null
let fnSetFps:                   ((fg: number, bg: number) => void) | null = null
let fnGetWindowThreadProcessId: ((hwnd: number, pid: Uint32Array) => number) | null = null
let hookInstalled = false

function loadAntiPauseDll() {
  if (fnInstallHook) return
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const koffi = require('koffi') as typeof import('koffi')
  const dllPath = app.isPackaged
    ? join(process.resourcesPath, 'anti_pause.dll')
    : join(__dirname, '..', '..', 'resources', 'anti_pause.dll')
  const dll    = koffi.load(dllPath)
  const user32 = koffi.load('user32.dll')
  fnInstallHook              = dll.func('bool __stdcall InstallHook(uint threadId)')
  fnRemoveHook               = dll.func('void __stdcall RemoveHook()')
  fnCreateConfig             = dll.func('void __stdcall CreateConfig()')
  fnSetFps                   = dll.func('void __stdcall SetFps(float fg, float bg)')
  fnGetWindowThreadProcessId = user32.func('uint __stdcall GetWindowThreadProcessId(intptr hWnd, uint *lpdwProcessId)')
  fnCreateConfig()
}

function startKeepFocus(hwnd: number) {
  if (!hwnd) return
  stopKeepFocus()
  loadAntiPauseDll()
  const pidBuf   = new Uint32Array(1)
  const threadId = fnGetWindowThreadProcessId!(hwnd, pidBuf)
  if (threadId) {
    hookInstalled = fnInstallHook!(threadId)
  }
}

function stopKeepFocus() {
  if (hookInstalled && fnRemoveHook) {
    try { fnRemoveHook() } catch { /* ignorieren */ }
    hookInstalled = false
  }
}

async function loadNut() {
  if (nutKeyboard) return
  const nut = await import('@nut-tree-fork/nut-js')
  nutKeyboard = nut.keyboard
  nutMouse = nut.mouse
  nutKey = nut.Key
}

async function loadUiohook() {
  if (uiohook) return
  uiohook = await import('uiohook-napi')
}

async function loadWindowUtils() {
  if (!winManager) winManager = await import('node-window-manager')
}

async function withGameFocus(windowTitle: string, fn: () => Promise<void>) {
  if (!windowTitle) {
    await fn()
    return
  }
  await loadWindowUtils()
  const { windowManager } = winManager!
  const prev = windowManager.getActiveWindow()
  const target = windowManager.getWindows().find((w) => {
    try { return w.getTitle().toLowerCase().includes(windowTitle.toLowerCase()) }
    catch { return false }
  })
  if (target) {
    target.bringToTop()
    await sleep(150)
  }
  await fn()
  await sleep(50)
  prev?.bringToTop()
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

// ─── Automation-Loops ────────────────────────────────────────────────────────


let afkPresses = 0
let afkNextTick = 0
let afkEnterNextTick = 0
let afkTickTimer: ReturnType<typeof setTimeout> | null = null

async function afkLoop(sHold: number, intervalMs: number, windowTitle: string, enterEnabled: boolean, enterIntervalMs: number) {
  if (stopFlags['afk']) return
  await loadNut()

  const now = Date.now()

  if (now >= afkNextTick) {
    await withGameFocus(windowTitle, async () => {
      await nutKeyboard!.pressKey(nutKey!.S)
      await sleep(sHold)
      await nutKeyboard!.releaseKey(nutKey!.S)
    })
    afkPresses++
    afkNextTick = now + intervalMs
  }

  if (enterEnabled && now >= afkEnterNextTick) {
    await withGameFocus(windowTitle, async () => {
      await nutKeyboard!.pressKey(nutKey!.Return)
      await sleep(50)
      await nutKeyboard!.releaseKey(nutKey!.Return)
    })
    afkEnterNextTick = now + enterIntervalMs
  }

  const remaining = Math.max(0, afkNextTick - Date.now())
  win?.webContents.send('afk:tick', {
    remaining: Math.floor(remaining / 1000),
    presses: afkPresses,
  })

  if (!stopFlags['afk']) {
    afkTickTimer = setTimeout(() => afkLoop(sHold, intervalMs, windowTitle, enterEnabled, enterIntervalMs), 250)
  }
}

async function wholdLoop() {
  if (stopFlags['whold']) return
  await loadNut()
  await nutKeyboard!.pressKey(nutKey!.W)

  const pulse = async () => {
    if (stopFlags['whold']) {
      await nutKeyboard!.releaseKey(nutKey!.W)
      return
    }
    await nutKeyboard!.pressKey(nutKey!.W)
    setTimeout(pulse, 200)
  }
  setTimeout(pulse, 200)
}

async function clickerLoop(button: 'left' | 'right' | 'middle', intervalMs: number) {
  if (stopFlags['clicker']) return
  await loadNut()

  const { Button: NutButton } = await import('@nut-tree-fork/nut-js')
  const btnMap = {
    left: NutButton.LEFT,
    right: NutButton.RIGHT,
    middle: NutButton.MIDDLE,
  }

  const tick = async () => {
    if (stopFlags['clicker']) return
    await nutMouse!.click(btnMap[button])
    await sleep(Math.max(10, intervalMs))
    tick()
  }
  tick()
}

async function autokeyLoop(key: string, downMs: number, upMs: number) {
  if (stopFlags['autokey']) return
  await loadNut()

  const nutKeyObj = (nutKey as Record<string, unknown>)[key] ?? null
  if (!nutKeyObj) return

  const tick = async () => {
    if (stopFlags['autokey']) return
    await nutKeyboard!.pressKey(nutKeyObj as never)
    await sleep(Math.max(10, downMs))
    await nutKeyboard!.releaseKey(nutKeyObj as never)
    await sleep(Math.max(10, upMs))
    tick()
  }
  tick()
}

// ─── IPC Handler ─────────────────────────────────────────────────────────────

function setupIpc() {
  ipcMain.handle('tool:start', async (_, { tool, config }: { tool: string; config: Record<string, unknown> }) => {
    stopFlags[tool] = false

    if (tool === 'afk') {
      const sHold = (config['sHold'] as number) || 200
      const intervalMs = (config['intervalMs'] as number) || 400000
      const windowTitle = (config['windowTitle'] as string) ?? ''
      const enterEnabled = (config['enterEnabled'] as boolean) ?? false
      const enterIntervalMs = (config['enterIntervalMs'] as number) || 60000
      afkPresses = 0
      afkNextTick = Date.now() + intervalMs
      afkEnterNextTick = Date.now() + enterIntervalMs

      // W durchgehend halten während Anti-AFK läuft
      await loadNut()
      await nutKeyboard!.pressKey(nutKey!.W)
      const wPulse = async () => {
        if (stopFlags['afk']) { await nutKeyboard!.releaseKey(nutKey!.W); return }
        await nutKeyboard!.pressKey(nutKey!.W)
        setTimeout(wPulse, 200)
      }
      setTimeout(wPulse, 200)

      afkLoop(sHold, intervalMs, windowTitle, enterEnabled, enterIntervalMs)
    } else if (tool === 'whold') {
      wholdLoop()
    } else if (tool === 'clicker') {
      clickerLoop(config['button'] as 'left' | 'right' | 'middle', config['intervalMs'] as number)
    } else if (tool === 'autokey') {
      autokeyLoop(config['key'] as string, config['downMs'] as number, config['upMs'] as number)
    }

    win?.webContents.send('tool:status', { tool, running: true })
  })

  ipcMain.handle('tool:stop', async (_, { tool }: { tool: string }) => {
    stopFlags[tool] = true
    if (tool === 'afk' && afkTickTimer) {
      clearTimeout(afkTickTimer)
      afkTickTimer = null
    }
    if ((tool === 'afk' || tool === 'whold') && nutKeyboard && nutKey) {
      await nutKeyboard.releaseKey(nutKey.W)
    }
    win?.webContents.send('tool:status', { tool, running: false })
  })

  ipcMain.handle('hotkey:set',   (_, { tool, raw }: { tool: string; raw: string }) => registerHotkey(tool, raw))
  ipcMain.handle('hotkey:clear', (_, { tool }: { tool: string })                   => unregisterHotkey(tool))

  ipcMain.handle('capture:start', async (_, { type }: { type: 'keyboard' | 'mouse' }) => {
    await loadUiohook()
    const { UiohookKey, uIOhook } = uiohook!

    if (type === 'keyboard') {
      const handler = (e: { keycode: number }) => {
        uIOhook.removeListener('keydown', handler)
        uIOhook.stop()
        const entry = Object.entries(UiohookKey).find(([, v]) => v === e.keycode)
        const label = entry ? entry[0] : `Key${e.keycode}`
        win?.webContents.send('capture:result', { label, value: label })
      }
      uIOhook.on('keydown', handler)
      uIOhook.start()
    } else {
      const emitter = uIOhook as unknown as NodeJS.EventEmitter & { start(): void; stop(): void }
      const handler = (e: unknown) => {
        emitter.removeListener('mousedown', handler)
        emitter.stop()
        const btn = (e as { button: number }).button
        const map: Record<number, string> = { 1: 'left', 2: 'right', 3: 'middle' }
        const btnLabel: Record<string, string> = { left: 'Links', right: 'Rechts', middle: 'Mitte' }
        const value = map[btn] ?? 'left'
        win?.webContents.send('capture:result', { label: btnLabel[value] ?? value, value })
      }
      emitter.on('mousedown', handler)
      emitter.start()
    }
  })

  ipcMain.handle('windows:list', async () => {
    await loadWindowUtils()
    const { windowManager } = winManager!
    const results: { title: string; handle: number; icon: string | null }[] = []
    for (const w of windowManager.getWindows()) {
      try {
        const title = w.getTitle()
        if (!title || title === 'Naizen-Tools' || title === 'Program Manager') continue
        let icon: string | null = null
        try {
          const buf = await w.getIcon(32)
          if (buf && buf.length > 0) icon = buf.toString('base64')
        } catch { /* kein Icon verfügbar */ }
        results.push({ title, handle: w.handle as number, icon })
      } catch { /* Fenster nicht mehr verfügbar */ }
    }
    return results
  })

  ipcMain.on('window:minimize', () => win?.minimize())
  ipcMain.on('window:maximize', () => (win?.isMaximized() ? win.unmaximize() : win?.maximize()))
  ipcMain.on('window:close', () => closeAction === 'quit' ? app.exit() : win?.hide())
  ipcMain.on('window:hide', () => win?.hide())
  ipcMain.on('window:quit', () => { saveWinState(); app.exit() })
  ipcMain.on('update:install', () => autoUpdater.quitAndInstall())
  ipcMain.on('close-action:set', (_, action: 'minimize' | 'quit') => { closeAction = action })

  ipcMain.handle('autostart:get', () => app.getLoginItemSettings().openAtLogin)
  ipcMain.handle('autostart:set', (_, { enabled }: { enabled: boolean }) => {
    app.setLoginItemSettings({ openAtLogin: enabled })
  })

  // ── iRacing ──────────────────────────────────────────────────────────────
  ipcMain.handle('iracing:status', () => iracing.connected)
  ipcMain.handle('iracing:sessionInfo', () => iracing.sessionInfo)

  // ── Screenshot ────────────────────────────────────────────────────────────
  ipcMain.handle('screenshot:take', async (_, config: ScreenshotConfig) => {
    if (!iracing.connected) throw new Error('iRacing not connected')
    if (takingScreenshot) throw new Error('Already taking screenshot')
    takingScreenshot = true

    const originalBounds = getIracingWindow()
    if (!originalBounds) { takingScreenshot = false; throw new Error('iRacing window not found') }

    const { targetWidth, targetHeight, captureWidth, captureHeight } = getCaptureDimensions(config)
    const cameraState = iracing.hideUI()

    try {
      await iracing.waitForUIHidden(500)
      resizeWindow(originalBounds, captureWidth, captureHeight)
      await new Promise((r) => setTimeout(r, 300))

      const sourceId = await getDesktopSource(originalBounds)

      // Ask renderer to capture
      win?.webContents.send('screenshot:capture', {
        sourceId,
        width: captureWidth,
        height: captureHeight,
      })

      // Wait for renderer to send back the image buffer
      const buffer = await new Promise<Buffer>((resolve, reject) => {
        pendingCapture = { resolve, reject }
        setTimeout(() => {
          pendingCapture = null
          reject(new Error('Capture timeout'))
        }, 15000)
      })

      const ext = EXT[config.outputFormat] ?? '.jpg'
      const format = config.useCustomFilename ? config.filenameFormat : '{track}-{driver}-{counter}'
      const outPath = resolveFilename(
        format,
        iracing.sessionInfo,
        iracing.telemetry.Lap,
        iracing.telemetry.SessionNum,
        config.folder,
        ext,
      )

      await processImage(buffer, targetWidth, targetHeight, config.crop, config.cropTopLeft ?? false, outPath)
      const thumb = await makeThumbnail(outPath).catch(() => null)

      return { path: outPath, thumb }
    } catch (e) {
      logScreenshotError(e, config)
      throw e
    } finally {
      iracing.restoreUI(cameraState)
      if (originalBounds && !config.manualRestore) restoreWindow(originalBounds)
      takingScreenshot = false
    }
  })

  ipcMain.on('screenshot:buffer', (_, buf: Uint8Array) => {
    if (pendingCapture) {
      if (!buf || buf.length === 0) pendingCapture.reject(new Error('Capture failed in renderer'))
      else pendingCapture.resolve(Buffer.from(buf))
      pendingCapture = null
    }
  })

  ipcMain.handle('screenshot:pickFolder', async () => {
    const result = await dialog.showOpenDialog(win!, {
      properties: ['openDirectory'],
      title: 'Select Screenshot Folder',
    })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle('screenshot:defaultFolder', () => {
    const folder = join(app.getPath('pictures'), 'iRacing')
    if (!existsSync(folder)) mkdirSync(folder, { recursive: true })
    return folder
  })

  ipcMain.handle('screenshot:list', async (_, folder: string) => {
    return listScreenshots(folder)
  })

  ipcMain.handle('screenshot:delete', (_, filePath: string) => {
    try {
      if (existsSync(filePath)) unlinkSync(filePath)
      const ext      = filePath.slice(filePath.lastIndexOf('.'))
      const name     = filePath.slice(filePath.lastIndexOf(/[\\/]/.test(filePath) ? filePath.lastIndexOf('\\') : filePath.lastIndexOf('/')) + 1)
      const thumbDir = join(app.getPath('userData'), 'ScreenshotCache')
      const thumb    = join(thumbDir, name.replace(ext, '.webp'))
      if (existsSync(thumb)) unlinkSync(thumb)
      return true
    } catch { return false }
  })

  ipcMain.on('screenshot:open', (_, filePath: string) => {
    shell.showItemInFolder(filePath)
  })

  ipcMain.on('screenshot:openExternal', (_, filePath: string) => {
    shell.openPath(filePath)
  })

  // ── App Launcher ──────────────────────────────────────────────────────────
  ipcMain.handle('apps:getIcon', async (_, exePath: string) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const extractFileIcon = require('extract-file-icon')
      const buf: Buffer = extractFileIcon(exePath, 32)
      return buf && buf.length > 0 ? buf.toString('base64') : null
    } catch { return null }
  })

  // ── INI Profiles ──────────────────────────────────────────────────────────
  ipcMain.handle('ini:detectFolder', () => iniProfiles.detectIracingFolder())
  ipcMain.handle('ini:listFiles', (_, folder: string) => iniProfiles.listConfigFiles(folder))
  ipcMain.handle('ini:mtimes', (_, folder: string) => iniProfiles.fileMtimes(folder))
  ipcMain.handle('ini:readFile', (_, { folder, file }: { folder: string; file: string }) => iniProfiles.readConfigFile(folder, file))
  ipcMain.handle('ini:writeFile', (_, { folder, file, content }: { folder: string; file: string; content: string }) => iniProfiles.writeConfigFile(folder, file, content))
  ipcMain.handle('ini:deleteFile', (_, { folder, file }: { folder: string; file: string }) => iniProfiles.deleteConfigFile(folder, file))
  ipcMain.handle('ini:migrate', (_, folder: string) => iniProfiles.migrateProfiles(folder))
  ipcMain.handle('ini:listProfiles', () => iniProfiles.listProfiles())
  ipcMain.handle('ini:create', (_, opts: { name: string; folder: string; managedFiles: string[] }) => iniProfiles.createProfile(opts))
  ipcMain.handle('ini:update', (_, { id, folder, managedFiles }: { id: string; folder: string; managedFiles: string[] }) => iniProfiles.updateProfile(id, folder, managedFiles))
  ipcMain.handle('ini:apply', (_, { id, folder }: { id: string; folder: string }) => iniProfiles.applyProfile(id, folder))
  ipcMain.handle('ini:delete', (_, id: string) => iniProfiles.deleteProfile(id))
  ipcMain.handle('ini:rename', (_, { id, name }: { id: string; name: string }) => iniProfiles.renameProfile(id, name))
  ipcMain.handle('ini:compare', (_, { id, folder }: { id: string; folder: string }) => iniProfiles.compareProfile(id, folder))
  ipcMain.handle('ini:pickFolder', async () => {
    const result = await dialog.showOpenDialog(win!, {
      title: 'Select iRacing Config Folder',
      properties: ['openDirectory'],
    })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.on('apps:launch', (_, id: string) => {
    const a = watchedApps.find((w) => w.id === id)
    if (a) launchApp(a)
  })
  ipcMain.on('apps:kill', (_, id: string) => killApp(id))
  ipcMain.on('apps:startAll', () => watchedApps.filter((a) => a.includeInStartAll).forEach(launchApp))
  ipcMain.on('apps:stopAll',  () => watchedApps.filter((a) => a.includeInStopAll).forEach((a) => killApp(a.id)))
  // Register the active profile's apps to watch/auto-manage, and start polling.
  ipcMain.on('apps:watch', (_, apps: AppEntry[]) => {
    watchedApps = apps.filter((a) => a.path)
    startPolling()
    pollProcesses()
  })
  ipcMain.handle('apps:pickExe', async () => {
    const result = await dialog.showOpenDialog(win!, {
      title: 'Select Application',
      filters: [{ name: 'Executables', extensions: ['exe'] }, { name: 'All Files', extensions: ['*'] }],
      properties: ['openFile'],
    })
    return result.canceled ? null : result.filePaths[0]
  })

  // ── Monitor Resolution ────────────────────────────────────────────────────
  ipcMain.handle('monitor:list', () => monitorList())
  ipcMain.handle('monitor:setResolution', (_, { deviceName, width, height, hz }: { deviceName: string; width: number; height: number; hz: number }) =>
    setMonitorResolution(deviceName, width, height, hz)
  )

  ipcMain.on('screenshot:restoreWindow', (_, bounds: { x: number; y: number; width: number; height: number }) => {
    const win = getIracingWindow()
    if (win) resizeWindow({ ...win, ...bounds }, bounds.width, bounds.height)
  })

  ipcMain.on('screenshot:hotkey:set', (_, hotkey: string) => {
    if (screenshotHotkeyAccel) {
      try { globalShortcut.unregister(screenshotHotkeyAccel) } catch { /* ignore */ }
    }
    screenshotHotkeyAccel = hotkey
    try {
      globalShortcut.register(hotkey, () => win?.webContents.send('screenshot:hotkey'))
    } catch { /* invalid accelerator */ }
  })

  ipcMain.on('screenshot:hotkey:clear', () => {
    if (screenshotHotkeyAccel) {
      try { globalShortcut.unregister(screenshotHotkeyAccel) } catch { /* ignore */ }
      screenshotHotkeyAccel = ''
    }
  })

  // ─── Word → PDF ────────────────────────────────────────────────────────────

  ipcMain.handle('word-pdf:pickFiles', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Select Word documents',
      filters: [{ name: 'Word Documents', extensions: ['docx'] }],
      properties: ['openFile', 'multiSelections'],
    })
    return result.canceled ? null : result.filePaths
  })

  ipcMain.handle('word-pdf:pickFolder', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Select output folder',
      properties: ['openDirectory'],
    })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle('word-pdf:convert', async (_, { inputPath, outFolder }: { inputPath: string; outFolder: string | null }) => {
    const { dirname, basename, join: pathJoin } = await import('path')
    const stem      = basename(inputPath, '.docx')
    const outputDir = outFolder ?? dirname(inputPath)
    const outputPath = pathJoin(outputDir, `${stem}.pdf`)

    const scriptPath = pathJoin(app.getPath('temp'), `word-pdf-${Date.now()}.ps1`)
    const script = [
      '$ErrorActionPreference = "Stop"',
      '$word = New-Object -ComObject Word.Application',
      '$word.Visible = $false',
      '$word.DisplayAlerts = 0',
      'try {',
      `    $doc = $word.Documents.Open("${inputPath.replace(/\\/g, '\\\\').replace(/"/g, '`"')}")`,
      `    $doc.SaveAs([ref]"${outputPath.replace(/\\/g, '\\\\').replace(/"/g, '`"')}", [ref]17)`,
      '    $doc.Close([ref]$false)',
      '} finally {',
      '    $word.Quit()',
      '    try { [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null } catch {}',
      '}',
    ].join('\n')

    writeFileSync(scriptPath, script, 'utf8')
    try {
      await new Promise<void>((resolve, reject) => {
        const proc = spawn('powershell', [
          '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', scriptPath,
        ])
        let stderr = ''
        proc.stderr.on('data', (d: Buffer) => { stderr += d.toString() })
        proc.on('close', (code: number) => {
          if (code === 0) resolve()
          else reject(new Error(stderr.trim() || `PowerShell exited with code ${code}`))
        })
      })
    } finally {
      try { unlinkSync(scriptPath) } catch { /* ignore */ }
    }
    return outputPath
  })

  ipcMain.on('word-pdf:open', (_, filePath: string) => {
    shell.openPath(filePath)
  })
}

// ─── Fenster ─────────────────────────────────────────────────────────────────

function createWindow() {
  const state = loadWinState()

  win = new BrowserWindow({
    width: state.width,
    height: state.height,
    ...(state.x !== -1 ? { x: state.x, y: state.y } : {}),
    minWidth: 800,
    minHeight: 500,
    frame: false,
    backgroundColor: '#07070f',
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  if (state.maximized) win.maximize()

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  win.webContents.on('will-navigate', (e) => e.preventDefault())

  if (process.env['NODE_ENV'] === 'development') {
    win.loadURL('http://localhost:5173')
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  win.on('close', (e) => {
    saveWinState()
    if (closeAction === 'quit') return
    e.preventDefault()
    win?.hide()
  })

  win.on('hide', () => {
    if (!tray || tray.isDestroyed()) createTray()
  })
}

// ─── Tray ────────────────────────────────────────────────────────────────────

function createTray() {
  const iconPath = app.isPackaged
    ? join(process.resourcesPath, 'assets/icon.png')
    : join(__dirname, '..', '..', 'assets', 'icon.png')
  tray = new Tray(iconPath)
  tray.setToolTip('Naizen-Tools')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Open', click: () => win?.show() },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          saveWinState()
          Object.keys(stopFlags).forEach((k) => (stopFlags[k] = true))
          app.exit()
        },
      },
    ]),
  )
  tray.on('double-click', () => win?.show())
}

// ─── Auto-Updater ────────────────────────────────────────────────────────────

// ─── App-Lifecycle ───────────────────────────────────────────────────────────

protocol.registerSchemesAsPrivileged([
  { scheme: 'app-file', privileges: { bypassCSP: true, stream: true, supportFetchAPI: true } },
])

app.whenReady().then(() => {
  protocol.registerFileProtocol('app-file', (request, callback) => {
    const path = decodeURIComponent(request.url.slice('app-file:///'.length))
    callback({ path })
  })

  setupIpc()
  createWindow()
  createTray()

  // iRacing SDK bridge (for screenshot tool). App auto start/stop is driven by
  // the process poller which watches iRacingUI.exe / iRacingSim64DX11.exe.
  iracing.on('connected',    () => win?.webContents.send('iracing:connected'))
  iracing.on('disconnected', () => win?.webContents.send('iracing:disconnected'))
  iracing.start().catch((e) => console.error('[iracing]', e))

  if (app.isPackaged) {
    autoUpdater.autoDownload = true
    autoUpdater.autoInstallOnAppQuit = false
    autoUpdater.on('update-downloaded', () => win?.webContents.send('update:downloaded'))
    autoUpdater.on('error', (e) => console.error('[updater]', e.message))
    autoUpdater.checkForUpdates()
  }
})

app.on('window-all-closed', () => { /* tray handles quit */ })
app.on('will-quit', () => { globalShortcut.unregisterAll(); iracing.stop(); killAllApps() })
app.on('activate', () => win?.show())
