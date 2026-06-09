import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createAppSlice, type AppSlice } from './slices/appSlice'
import { createMacrosSlice, type MacrosSlice } from './slices/macrosSlice'
import { createIracingSlice, type IracingSlice } from './slices/iracingSlice'
import { createToolsSlice, type ToolsSlice } from './slices/toolsSlice'
import { defaultApp, type IracingProfile, type ScreenshotConfig } from './types'

// Re-export so components can keep importing from '@/store/toolStore'
export type { IracingApp, IracingProfile, ScreenshotConfig, ToolConfig } from './types'
export { defaultApp } from './types'
export type { WordPdfFile } from './slices/toolsSlice'

export type FullState = AppSlice & MacrosSlice & IracingSlice & ToolsSlice

export const useToolStore = create<FullState>()(
  persist(
    (...args) => ({
      ...createAppSlice(...args),
      ...createMacrosSlice(...args),
      ...createIracingSlice(...args),
      ...createToolsSlice(...args),
    }),
    {
      name: 'naizen-tools-store',
      version: 7,
      migrate: (stored: unknown) => {
        const s = stored as {
          theme?: string
          closeAction?: 'minimize' | 'quit'
          rememberCloseAction?: boolean
          screenshot?: ScreenshotConfig
          iracingApps?: Parameters<typeof defaultApp>[0][]
          iracingProfiles?: IracingProfile[]
          activeProfileId?: string
          config?: {
            afk?: Record<string, unknown>
            clicker?: Record<string, unknown>
            autokey?: Record<string, unknown>
          }
        }
        const profiles: IracingProfile[] = s.iracingProfiles ?? [{
          id: 'default',
          name: 'Default',
          apps: (s.iracingApps ?? []).map((a) => defaultApp(a)),
        }]
        return {
          theme: s.theme ?? 'dark',
          closeAction: s.closeAction ?? 'minimize',
          rememberCloseAction: s.rememberCloseAction ?? false,
          screenshot: s.screenshot,
          iracingProfiles: profiles,
          activeProfileId: s.activeProfileId ?? profiles[0]?.id ?? 'default',
          config: {
            afk:     { sHold: 200, intervalMs: 400000, windowTitle: '', hotkey: null, enterEnabled: false, enterIntervalMs: 60000, ...(s.config?.afk ?? {}) },
            whold:   {},
            clicker: { button: 'left', intervalMs: 100,                hotkey: null, ...(s.config?.clicker  ?? {}) },
            autokey: { key: null, keyLabel: '—', downMs: 50, upMs: 50, hotkey: null, ...(s.config?.autokey  ?? {}) },
          },
        }
      },
      partialize: (s) => ({
        theme: s.theme,
        closeAction: s.closeAction,
        rememberCloseAction: s.rememberCloseAction,
        screenshot: s.screenshot,
        iracingProfiles: s.iracingProfiles,
        activeProfileId: s.activeProfileId,
        iniFolder: s.iniFolder,
        iniActiveProfileId: s.iniActiveProfileId,
        iniManagedFiles: s.iniManagedFiles,
        config: s.config,
      }),
    },
  ),
)
