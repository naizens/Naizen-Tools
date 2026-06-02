declare const __APP_VERSION__: string

interface WindowInfo {
  title: string
  handle: number
  icon: string | null
}

interface Window {
  api: {
    startTool: (tool: string, config: Record<string, unknown>) => Promise<void>
    stopTool: (tool: string) => Promise<void>
    startCapture: (type: 'keyboard' | 'mouse') => Promise<void>
    windowMinimize: () => void
    windowMaximize: () => void
    windowClose: () => void
    onUpdateDownloaded: (cb: () => void) => () => void
    updateInstall: () => void
    windowsList: () => Promise<WindowInfo[]>
    setGameFps: (fg: number, bg: number) => Promise<void>
    setHotkey: (tool: string, raw: string) => Promise<void>
    clearHotkey: (tool: string) => Promise<void>
    onToolStatus: (cb: (data: { tool: string; running: boolean }) => void) => void
    onCaptureResult: (cb: (data: { label: string; value: string }) => void) => void
    onAfkTick: (cb: (data: { remaining: number; presses: number }) => void) => void
    onHotkeyTrigger: (cb: (data: { tool: string }) => void) => void
    getAutostart: () => Promise<boolean>
    setAutostart: (enabled: boolean) => Promise<void>
    setCloseAction: (action: 'minimize' | 'quit') => void
    iracingStatus: () => Promise<boolean>
    iracingSessionInfo: () => Promise<unknown>
    onIracingConnected: (cb: () => void) => () => void
    onIracingDisconnected: (cb: () => void) => () => void
    takeScreenshot: (config: unknown) => Promise<{ path: string; thumb: string | null }>
    submitScreenshotBuffer: (buf: Buffer) => void
    onScreenshotCapture: (cb: (data: { sourceId: string | null; width: number; height: number }) => void) => () => void
    onScreenshotHotkey: (cb: () => void) => () => void
    setScreenshotHotkey: (hotkey: string) => void
    clearScreenshotHotkey: () => void
    listScreenshots: (folder: string) => Promise<{ path: string; name: string; thumb: string | null; mtime: number }[]>
    openScreenshot: (filePath: string) => void
    openScreenshotExternal: (filePath: string) => void
    restoreIracingWindow: (bounds: { x: number; y: number; width: number; height: number }) => void
    appsLaunch: (app: unknown) => void
    appsKill: (id: string) => void
    appsLaunchAll: (apps: unknown[]) => void
    appsRunning: () => Promise<string[]>
    appsPickExe: () => Promise<string | null>
    appsGetIcon: (exePath: string) => Promise<string | null>
    onAppsStatus: (cb: (data: { id: string; running: boolean }) => void) => () => void
    onAppsGetList: (cb: () => void) => () => void
    pickScreenshotFolder: () => Promise<string | null>
    defaultScreenshotFolder: () => Promise<string>
  }
}
