import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  startTool: (tool: string, config: Record<string, unknown>) =>
    ipcRenderer.invoke('tool:start', { tool, config }),
  stopTool: (tool: string) => ipcRenderer.invoke('tool:stop', { tool }),
  startCapture: (type: 'keyboard' | 'mouse') => ipcRenderer.invoke('capture:start', { type }),
  windowMinimize: () => ipcRenderer.send('window:minimize'),
  windowMaximize: () => ipcRenderer.send('window:maximize'),
  windowClose: () => ipcRenderer.send('window:close'),
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
  onUpdateAvailable: (cb: () => void) => { ipcRenderer.on('update:available', cb) },
  onUpdateReady:     (cb: () => void) => { ipcRenderer.on('update:ready',     cb) },
  getAutostart: () => ipcRenderer.invoke('autostart:get') as Promise<boolean>,
  setAutostart: (enabled: boolean) => ipcRenderer.invoke('autostart:set', { enabled }),
})
