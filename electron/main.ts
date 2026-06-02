import { app, BrowserWindow, dialog, ipcMain, Menu, protocol, screen, Tray, shell, globalShortcut } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync } from 'fs'
import { autoUpdater } from 'electron-updater'
import { IracingBridge } from './iracing'
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
  game: true,
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
    } else if (tool === 'game') {
      const windowTitle = (config['windowTitle'] as string) ?? ''
      const fgFps       = (config['fgFps'] as number) ?? 0
      const bgFps       = (config['bgFps'] as number) ?? 0
      loadAntiPauseDll()
      fnSetFps!(fgFps, bgFps)
      if (windowTitle) {
        await loadWindowUtils()
        const target = winManager!.windowManager.getWindows().find((w) => {
          try { return w.getTitle().toLowerCase().includes(windowTitle.toLowerCase()) }
          catch { return false }
        })
        if (target) startKeepFocus(target.handle as number)
      }
    }

    win?.webContents.send('tool:status', { tool, running: true })
  })

  ipcMain.handle('tool:stop', async (_, { tool }: { tool: string }) => {
    stopFlags[tool] = true
    if (tool === 'game') {
      stopKeepFocus()
      if (fnSetFps) fnSetFps(0, 0)
    }
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

  ipcMain.handle('game:setFps', (_, { fg, bg }: { fg: number; bg: number }) => {
    loadAntiPauseDll()
    fnSetFps!(fg, bg)
  })

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
      const outPath = resolveFilename(
        config.filenameFormat,
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

  ipcMain.on('screenshot:buffer', (_, buf: Buffer) => {
    if (pendingCapture) {
      pendingCapture.resolve(buf)
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
    const { homedir } = require('os') as typeof import('os')
    return join(homedir(), 'Pictures', 'Screenshots')
  })

  ipcMain.handle('screenshot:list', async (_, folder: string) => {
    return listScreenshots(folder)
  })

  ipcMain.on('screenshot:open', (_, filePath: string) => {
    shell.showItemInFolder(filePath)
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

app.whenReady().then(() => {
  setupIpc()
  createWindow()
  createTray()

  // iRacing SDK bridge
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
app.on('will-quit', () => { globalShortcut.unregisterAll(); iracing.stop() })
app.on('activate', () => win?.show())
