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
    updateDownload: () => void
    updateInstall: () => void
    windowsList: () => Promise<WindowInfo[]>
    setGameFps: (fg: number, bg: number) => Promise<void>
    setHotkey: (tool: string, raw: string) => Promise<void>
    clearHotkey: (tool: string) => Promise<void>
    onToolStatus: (cb: (data: { tool: string; running: boolean }) => void) => void
    onCaptureResult: (cb: (data: { label: string; value: string }) => void) => void
    onAfkTick: (cb: (data: { remaining: number; presses: number }) => void) => void
    onHotkeyTrigger: (cb: (data: { tool: string }) => void) => void
    onUpdateAvailable:   (cb: () => void) => void
    onUpdateDownloading: (cb: () => void) => void
    onUpdateReady:       (cb: () => void) => void
    getAutostart: () => Promise<boolean>
    setAutostart: (enabled: boolean) => Promise<void>
  }
}
