import type { StateCreator } from 'zustand'
import type { IracingApp, IracingProfile, ScreenshotConfig } from '../types'
import type { FullState } from '../toolStore'

export interface IracingSlice {
  screenshot: ScreenshotConfig
  iracingProfiles: IracingProfile[]
  activeProfileId: string
  iniFolder: string
  iniActiveProfileId: string
  iniManagedFiles: string[]
  setScreenshot: (cfg: Partial<ScreenshotConfig>) => void
  setProfiles: (profiles: IracingProfile[]) => void
  setActiveProfile: (id: string) => void
  setProfileApps: (profileId: string, apps: IracingApp[]) => void
  setIniFolder: (folder: string) => void
  setIniActiveProfile: (id: string) => void
  setIniManagedFiles: (files: string[]) => void
}

export const createIracingSlice: StateCreator<FullState, [], [], IracingSlice> = (set) => ({
  screenshot: {
    resolution: '1080p',
    customWidth: 1920,
    customHeight: 1080,
    crop: true,
    cropTopLeft: false,
    keepAspectRatio: false,
    outputFormat: 'jpeg',
    folder: '',
    useCustomFilename: false,
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
  iracingProfiles: [{ id: 'default', name: 'Default', apps: [] }],
  activeProfileId: 'default',
  iniFolder: '',
  iniActiveProfileId: '',
  iniManagedFiles: ['app.ini', 'rendererDX11Monitor.ini'],

  setScreenshot: (cfg) => set((s) => ({ screenshot: { ...s.screenshot, ...cfg } })),
  setProfiles: (iracingProfiles) => set({ iracingProfiles }),
  setActiveProfile: (activeProfileId) => set({ activeProfileId }),
  setProfileApps: (profileId, apps) =>
    set((s) => ({
      iracingProfiles: s.iracingProfiles.map((p) =>
        p.id === profileId ? { ...p, apps } : p,
      ),
    })),
  setIniFolder:         (iniFolder)         => set({ iniFolder }),
  setIniActiveProfile:  (iniActiveProfileId) => set({ iniActiveProfileId }),
  setIniManagedFiles:   (iniManagedFiles)   => set({ iniManagedFiles }),
})
