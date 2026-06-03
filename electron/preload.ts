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
  submitScreenshotBuffer: (buf: Uint8Array) => ipcRenderer.send('screenshot:buffer', buf),
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
  deleteScreenshot: (filePath: string) => ipcRenderer.invoke('screenshot:delete', filePath) as Promise<boolean>,
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

  // INI profiles
  iniDetectFolder: () => ipcRenderer.invoke('ini:detectFolder') as Promise<string>,
  iniListFiles: (folder: string) => ipcRenderer.invoke('ini:listFiles', folder) as Promise<string[]>,
  iniMtimes: (folder: string) => ipcRenderer.invoke('ini:mtimes', folder) as Promise<Record<string, number>>,
  iniReadFile: (folder: string, file: string) => ipcRenderer.invoke('ini:readFile', { folder, file }) as Promise<string>,
  iniWriteFile: (folder: string, file: string, content: string) => ipcRenderer.invoke('ini:writeFile', { folder, file, content }) as Promise<boolean>,
  iniDeleteFile: (folder: string, file: string) => ipcRenderer.invoke('ini:deleteFile', { folder, file }) as Promise<boolean>,
  iniMigrate: (folder: string) => ipcRenderer.invoke('ini:migrate', folder) as Promise<void>,
  iniListProfiles: () => ipcRenderer.invoke('ini:listProfiles') as Promise<{ id: string; name: string; slug: string; files: string[]; savedAt: number }[]>,
  iniCreate: (opts: { name: string; folder: string; managedFiles: string[] }) => ipcRenderer.invoke('ini:create', opts) as Promise<{ id: string; name: string; slug: string; files: string[]; savedAt: number }>,
  iniUpdate: (id: string, folder: string, managedFiles: string[]) => ipcRenderer.invoke('ini:update', { id, folder, managedFiles }) as Promise<{ updated: string[] }>,
  iniApply: (id: string, folder: string) => ipcRenderer.invoke('ini:apply', { id, folder }) as Promise<{ applied: string[]; failed: string[] }>,
  iniCompare: (id: string, folder: string) => ipcRenderer.invoke('ini:compare', { id, folder }) as Promise<{ changed: string[] }>,
  iniDelete: (id: string) => ipcRenderer.invoke('ini:delete', id) as Promise<void>,
  iniRename: (id: string, name: string) => ipcRenderer.invoke('ini:rename', { id, name }) as Promise<void>,
  iniPickFolder: () => ipcRenderer.invoke('ini:pickFolder') as Promise<string | null>,

  // Monitor resolution
  monitorList: () => ipcRenderer.invoke('monitor:list') as Promise<{ name: string; label: string; x: number; y: number; width: number; height: number; hz: number; modes: { width: number; height: number; hz: number }[] }[]>,
  monitorSetResolution: (deviceName: string, width: number, height: number, hz: number) =>
    ipcRenderer.invoke('monitor:setResolution', { deviceName, width, height, hz }) as Promise<number>,
})
