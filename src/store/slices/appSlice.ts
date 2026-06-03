import type { StateCreator } from 'zustand'
import type { FullState } from '../toolStore'

export interface AppSlice {
  theme: 'dark' | 'light'
  closeAction: 'minimize' | 'quit'
  rememberCloseAction: boolean
  autostart: boolean | null
  setTheme: (t: 'dark' | 'light') => void
  setCloseAction: (v: 'minimize' | 'quit') => void
  setRememberCloseAction: (v: boolean) => void
  setAutostart: (v: boolean) => void
}

export const createAppSlice: StateCreator<FullState, [], [], AppSlice> = (set) => ({
  theme: 'dark',
  closeAction: 'minimize',
  rememberCloseAction: false,
  autostart: null,
  setTheme:               (theme)               => set({ theme }),
  setCloseAction:         (closeAction)         => set({ closeAction }),
  setRememberCloseAction: (rememberCloseAction) => set({ rememberCloseAction }),
  setAutostart:           (autostart)           => set({ autostart }),
})
