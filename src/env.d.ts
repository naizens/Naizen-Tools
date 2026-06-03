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
    submitScreenshotBuffer: (buf: Uint8Array) => void
    onScreenshotCapture: (cb: (data: { sourceId: string | null; width: number; height: number }) => void) => () => void
    onScreenshotHotkey: (cb: () => void) => () => void
    setScreenshotHotkey: (hotkey: string) => void
    clearScreenshotHotkey: () => void
    listScreenshots: (folder: string) => Promise<{ path: string; name: string; thumb: string | null; mtime: number }[]>
    openScreenshot: (filePath: string) => void
    deleteScreenshot: (filePath: string) => Promise<boolean>
    openScreenshotExternal: (filePath: string) => void
    restoreIracingWindow: (bounds: { x: number; y: number; width: number; height: number }) => void
    appsLaunch: (id: string) => void
    appsKill: (id: string) => void
    appsStartAll: () => void
    appsStopAll: () => void
    appsWatch: (apps: unknown[]) => void
    appsPickExe: () => Promise<string | null>
    appsGetIcon: (exePath: string) => Promise<string | null>
    onAppsStatus: (cb: (data: { id: string; running: boolean; exists: boolean }) => void) => () => void
    onAppsError: (cb: (data: { id: string; message: string }) => void) => () => void
    pickScreenshotFolder: () => Promise<string | null>
    defaultScreenshotFolder: () => Promise<string>
    iniDetectFolder: () => Promise<string>
    iniListFiles: (folder: string) => Promise<string[]>
    iniMtimes: (folder: string) => Promise<Record<string, number>>
    iniReadFile: (folder: string, file: string) => Promise<string>
    iniWriteFile: (folder: string, file: string, content: string) => Promise<boolean>
    iniDeleteFile: (folder: string, file: string) => Promise<boolean>
    iniMigrate: (folder: string) => Promise<void>
    iniListProfiles: () => Promise<{ id: string; name: string; slug: string; files: string[]; savedAt: number }[]>
    iniCreate: (opts: { name: string; folder: string; managedFiles: string[] }) => Promise<{ id: string; name: string; slug: string; files: string[]; savedAt: number }>
    iniUpdate: (id: string, folder: string, managedFiles: string[]) => Promise<{ updated: string[] }>
    iniApply: (id: string, folder: string) => Promise<{ applied: string[]; failed: string[] }>
    iniCompare: (id: string, folder: string) => Promise<{ changed: string[] }>
    iniDelete: (id: string) => Promise<void>
    iniRename: (id: string, name: string) => Promise<void>
    iniPickFolder: () => Promise<string | null>
    monitorList: () => Promise<{ name: string; label: string; x: number; y: number; width: number; height: number; hz: number; modes: { width: number; height: number; hz: number }[] }[]>
    monitorSetResolution: (deviceName: string, width: number, height: number, hz: number) => Promise<number>
  }
}
