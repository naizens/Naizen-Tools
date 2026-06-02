import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  startTool: (tool: string, config: Record<string, unknown>) =>
    ipcRenderer.invoke('tool:start', { tool, config }),
  stopTool: (tool: string) => ipcRenderer.invoke('tool:stop', { tool }),
  startCapture: (type: 'keyboard' | 'mouse') => ipcRenderer.invoke('capture:start', { type }),
  windowMinimize: () => ipcRenderer.send('window:minimize'),
  windowMaximize: () => ipcRenderer.send('window:maximize'),
  windowClose: () => ipcRenderer.send('window:close'),
  onUpdateDownloaded: (cb: () => void) => {
    const handler = () => cb()
    ipcRenderer.on('update:downloaded', handler)
    return () => ipcRenderer.off('update:downloaded', handler)
  },
  updateInstall: () => ipcRenderer.send('update:install'),
  windowsList: () => ipcRenderer.invoke('windows:list'),
  setGameFps: (fg: number, bg: number) => ipcRenderer.invoke('game:setFps', { fg, bg }),
  setHotkey: (tool: string, raw: string) => ipcRenderer.invoke('hotkey:set', { tool, raw }),
  clearHotkey: (tool: string) => ipcRenderer.invoke('hotkey:clear', { tool }),
  onToolStatus: (cb: (data: { tool: string; running: boolean }) => void) => {
    ipcRenderer.on('tool:status', (_, data) => cb(data as { tool: string; running: boolean }))
  },
  onCaptureResult: (cb: (data: { label: string; value: string }) => void) => {
    ipcRenderer.removeAllListeners('capture:result')
    ipcRenderer.once('capture:result', (_, data) => cb(data as { label: string; value: string }))
  },
  onAfkTick: (cb: (data: { remaining: number; presses: number }) => void) => {
    ipcRenderer.on('afk:tick', (_, data) => cb(data as { remaining: number; presses: number }))
  },
  onHotkeyTrigger: (cb: (data: { tool: string }) => void) => {
    ipcRenderer.on('hotkey:trigger', (_, data) => cb(data as { tool: string }))
  },
  getAutostart: () => ipcRenderer.invoke('autostart:get') as Promise<boolean>,
  setAutostart: (enabled: boolean) => ipcRenderer.invoke('autostart:set', { enabled }),
  setCloseAction: (action: 'minimize' | 'quit') => ipcRenderer.send('close-action:set', action),

  // iRacing
  iracingStatus: () => ipcRenderer.invoke('iracing:status') as Promise<boolean>,
  iracingSessionInfo: () => ipcRenderer.invoke('iracing:sessionInfo') as Promise<unknown>,
  onIracingConnected: (cb: () => void) => {
    ipcRenderer.on('iracing:connected', cb)
    return () => ipcRenderer.off('iracing:connected', cb)
  },
  onIracingDisconnected: (cb: () => void) => {
    ipcRenderer.on('iracing:disconnected', cb)
    return () => ipcRenderer.off('iracing:disconnected', cb)
  },

  // Screenshot
  takeScreenshot: (config: unknown) => ipcRenderer.invoke('screenshot:take', config) as Promise<{ path: string; thumb: string | null }>,
  submitScreenshotBuffer: (buf: Buffer) => ipcRenderer.send('screenshot:buffer', buf),
  onScreenshotCapture: (cb: (data: { sourceId: string | null; width: number; height: number }) => void) => {
    const handler = (_: Electron.IpcRendererEvent, data: unknown) => cb(data as { sourceId: string | null; width: number; height: number })
    ipcRenderer.on('screenshot:capture', handler)
    return () => ipcRenderer.off('screenshot:capture', handler)
  },
  onScreenshotHotkey: (cb: () => void) => {
    ipcRenderer.on('screenshot:hotkey', cb)
    return () => ipcRenderer.off('screenshot:hotkey', cb)
  },
  setScreenshotHotkey: (hotkey: string) => ipcRenderer.send('screenshot:hotkey:set', hotkey),
  clearScreenshotHotkey: () => ipcRenderer.send('screenshot:hotkey:clear'),
  listScreenshots: (folder: string) => ipcRenderer.invoke('screenshot:list', folder),
  openScreenshot: (filePath: string) => ipcRenderer.send('screenshot:open', filePath),
  openScreenshotExternal: (filePath: string) => ipcRenderer.send('screenshot:openExternal', filePath),
  restoreIracingWindow: (bounds: { x: number; y: number; width: number; height: number }) => ipcRenderer.send('screenshot:restoreWindow', bounds),
  appsLaunch: (id: string) => ipcRenderer.send('apps:launch', id),
  appsKill: (id: string) => ipcRenderer.send('apps:kill', id),
  appsStartAll: () => ipcRenderer.send('apps:startAll'),
  appsStopAll: () => ipcRenderer.send('apps:stopAll'),
  appsWatch: (apps: unknown[]) => ipcRenderer.send('apps:watch', apps),
  appsPickExe: () => ipcRenderer.invoke('apps:pickExe') as Promise<string | null>,
  appsGetIcon: (exePath: string) => ipcRenderer.invoke('apps:getIcon', exePath) as Promise<string | null>,
  onAppsStatus: (cb: (data: { id: string; running: boolean; exists: boolean }) => void) => {
    const handler = (_: Electron.IpcRendererEvent, data: unknown) => cb(data as { id: string; running: boolean; exists: boolean })
    ipcRenderer.on('apps:status', handler)
    return () => ipcRenderer.off('apps:status', handler)
  },
  onAppsError: (cb: (data: { id: string; message: string }) => void) => {
    const handler = (_: Electron.IpcRendererEvent, data: unknown) => cb(data as { id: string; message: string })
    ipcRenderer.on('apps:error', handler)
    return () => ipcRenderer.off('apps:error', handler)
  },
  pickScreenshotFolder: () => ipcRenderer.invoke('screenshot:pickFolder') as Promise<string | null>,
  defaultScreenshotFolder: () => ipcRenderer.invoke('screenshot:defaultFolder') as Promise<string>,
})
