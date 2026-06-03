import type { StateCreator } from 'zustand'
import type { ToolConfig } from '../types'
import type { FullState } from '../toolStore'

export interface MacrosSlice {
  running: Record<keyof ToolConfig, boolean>
  config: ToolConfig
  afkPresses: number
  afkRemaining: number
  setConfig: <K extends keyof ToolConfig>(tool: K, cfg: Partial<ToolConfig[K]>) => void
  setRunning: (tool: keyof ToolConfig, running: boolean) => void
  setAfkTick: (remaining: number, presses: number) => void
}

export const createMacrosSlice: StateCreator<FullState, [], [], MacrosSlice> = (set) => ({
  running: { afk: false, whold: false, clicker: false, autokey: false },
  config: {
    afk:     { sHold: 200, intervalMs: 400000, windowTitle: '', hotkey: null, enterEnabled: false, enterIntervalMs: 60000 },
    whold:   {},
    clicker: { button: 'left', intervalMs: 100, hotkey: null },
    autokey: { key: null, keyLabel: '—', downMs: 50, upMs: 50, hotkey: null },
  },
  afkPresses: 0,
  afkRemaining: 0,

  setConfig: (tool, cfg) =>
    set((s) => ({ config: { ...s.config, [tool]: { ...s.config[tool], ...cfg } } })),

  setRunning: (tool, running) =>
    set((s) => ({ running: { ...s.running, [tool]: running } })),

  setAfkTick: (afkRemaining, afkPresses) =>
    set({ afkRemaining, afkPresses }),
})
