export interface IracingApp {
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

export interface IracingProfile {
  id: string
  name: string
  apps: IracingApp[]
}

export function defaultApp(partial: Partial<IracingApp> = {}): IracingApp {
  return {
    id: Math.random().toString(36).slice(2, 10),
    name: 'App',
    path: '',
    args: '',
    startHidden: false,
    startWithSim: true,
    stopWithSim: true,
    startWithUi: false,
    stopWithUi: false,
    includeInStartAll: true,
    includeInStopAll: true,
    ...partial,
  }
}

export interface ScreenshotConfig {
  resolution: '1080p' | '2k' | '4k' | '5k' | '6k' | '7k' | '8k' | 'custom'
  customWidth: number
  customHeight: number
  crop: boolean
  cropTopLeft: boolean
  keepAspectRatio: boolean
  outputFormat: 'jpeg' | 'png' | 'webp'
  folder: string
  useCustomFilename: boolean
  filenameFormat: string
  hotkey: string
  screenWidth: number
  screenHeight: number
  manualRestore: boolean
  manualRestoreX: number
  manualRestoreY: number
  manualRestoreWidth: number
  manualRestoreHeight: number
}

export interface ToolConfig {
  afk: { sHold: number; intervalMs: number; windowTitle: string; hotkey: string | null; enterEnabled: boolean; enterIntervalMs: number }
  whold: Record<string, never>
  clicker: { button: 'left' | 'right' | 'middle'; intervalMs: number; hotkey: string | null }
  autokey: { key: string | null; keyLabel: string; downMs: number; upMs: number; hotkey: string | null }
}
