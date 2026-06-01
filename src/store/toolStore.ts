import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface ToolConfig {
  afk: { sHold: number; intervalMs: number; windowTitle: string; hotkey: string | null; enterEnabled: boolean; enterIntervalMs: number }
  whold: Record<string, never>
  clicker: { button: 'left' | 'right' | 'middle'; intervalMs: number; hotkey: string | null }
  autokey: { key: string | null; keyLabel: string; downMs: number; upMs: number; hotkey: string | null }
  game: { windowTitle: string; fgFps: number; bgFps: number; hotkey: string | null }
}

interface ToolState {
  theme: 'dark' | 'light'
  autostart: boolean | null
  running: Record<keyof ToolConfig, boolean>
  config: ToolConfig
  afkPresses: number
  afkRemaining: number
  setTheme: (t: 'dark' | 'light') => void
  setAutostart: (v: boolean) => void
  setConfig: <K extends keyof ToolConfig>(tool: K, cfg: Partial<ToolConfig[K]>) => void
  setRunning: (tool: keyof ToolConfig, running: boolean) => void
  setAfkTick: (remaining: number, presses: number) => void
}

export const useToolStore = create<ToolState>()(
  persist(
    (set) => ({
      theme: 'dark',
      autostart: null,
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
      setAutostart: (autostart) => set({ autostart }),

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
      version: 4,
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
        config: s.config,
      }),
    },
  ),
)