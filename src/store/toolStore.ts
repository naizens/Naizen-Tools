import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface ToolConfig {
  afk: { sHold: number; intervalMs: number; windowTitle: string; hotkey: string | null; enterEnabled: boolean; enterIntervalMs: number }
  whold: Record<string, never>
  clicker: { button: 'left' | 'right' | 'middle'; intervalMs: number; hotkey: string | null }
  autokey: { key: string | null; keyLabel: string; downMs: number; upMs: number; hotkey: string | null }
  game: { windowTitle: string; fgFps: number; bgFps: number; hotkey: string | null }
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

interface ToolState {
  theme: 'dark' | 'light'
  closeAction: 'minimize' | 'quit'
  autostart: boolean | null
  screenshot: ScreenshotConfig
  running: Record<keyof ToolConfig, boolean>
  config: ToolConfig
  afkPresses: number
  afkRemaining: number
  setTheme: (t: 'dark' | 'light') => void
  setCloseAction: (v: 'minimize' | 'quit') => void
  setAutostart: (v: boolean) => void
  setScreenshot: (cfg: Partial<ScreenshotConfig>) => void
  setConfig: <K extends keyof ToolConfig>(tool: K, cfg: Partial<ToolConfig[K]>) => void
  setRunning: (tool: keyof ToolConfig, running: boolean) => void
  setAfkTick: (remaining: number, presses: number) => void
}

export const useToolStore = create<ToolState>()(
  persist(
    (set) => ({
      theme: 'dark',
      closeAction: 'minimize',
      autostart: null,
      screenshot: {
        resolution: '1080p',
        customWidth: 1920,
        customHeight: 1080,
        crop: true,
        cropTopLeft: false,
        keepAspectRatio: false,
        outputFormat: 'jpeg',
        folder: '',
        filenameFormat: '{track}-{driver}-{counter}',
        hotkey: 'Control+PrintScreen',
        screenWidth: 0,
        screenHeight: 0,
        manualRestore: false,
        manualRestoreX: 0,
        manualRestoreY: 0,
        manualRestoreWidth: 1920,
        manualRestoreHeight: 1080,
      },
      running: {
        afk: false,
        whold: false,
        clicker: false,
        autokey: false,
        game: false,
      },
      config: {
        afk:     { sHold: 200, intervalMs: 400000, windowTitle: '', hotkey: null, enterEnabled: false, enterIntervalMs: 60000 },
        whold:   {},
        clicker: { button: 'left', intervalMs: 100, hotkey: null },
        autokey: { key: null, keyLabel: '—', downMs: 50, upMs: 50, hotkey: null },
        game:    { windowTitle: '', fgFps: 0, bgFps: 0, hotkey: null },
      },

      afkPresses: 0,
      afkRemaining: 0,

      setTheme: (theme) => set({ theme }),
      setCloseAction: (closeAction) => set({ closeAction }),
      setAutostart: (autostart) => set({ autostart }),
      setScreenshot: (cfg) => set((s) => ({ screenshot: { ...s.screenshot, ...cfg } })),

      setConfig: (tool, cfg) =>
        set((s) => ({
          config: {
            ...s.config,
            [tool]: {
              ...s.config[tool],
              ...cfg,
            },
          },
        })),

      setRunning: (tool, running) =>
        set((s) => ({
          running: {
            ...s.running,
            [tool]: running,
          },
        })),

      setAfkTick: (afkRemaining, afkPresses) =>
        set({ afkRemaining, afkPresses }),
    }),
    {
      name: 'naizen-tools-store',
      version: 6,
      migrate: (stored: unknown) => {
        const s = stored as {
          theme?: string
          config?: {
            afk?: Record<string, unknown>
            clicker?: Record<string, unknown>
            autokey?: Record<string, unknown>
            game?: Record<string, unknown>
          }
        }
        return {
          theme: s.theme ?? 'dark',
          config: {
            afk:     { sHold: 200, intervalMs: 400000, windowTitle: '', hotkey: null, enterEnabled: false, enterIntervalMs: 60000, ...(s.config?.afk ?? {}) },
            whold:   {},
            clicker: { button: 'left', intervalMs: 100,                hotkey: null, ...(s.config?.clicker  ?? {}) },
            autokey: { key: null, keyLabel: '—', downMs: 50, upMs: 50, hotkey: null, ...(s.config?.autokey  ?? {}) },
            game:    { windowTitle: '', fgFps: 0, bgFps: 0,            hotkey: null, ...(s.config?.game     ?? {}) },
          },
        }
      },
      partialize: (s) => ({
        theme: s.theme,
        closeAction: s.closeAction,
        screenshot: s.screenshot,
        config: s.config,
      }),
    },
  ),
)