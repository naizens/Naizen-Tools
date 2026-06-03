import React, { Suspense, useEffect, useState } from 'react'
import { useToolStore } from './store/toolStore'
import TitleBar from './components/shell/TitleBar'
import Navbar, { type Tool } from './components/shell/Navbar'
import UpdateBadge from './components/shell/UpdateBadge'
import CloseDialog from './components/shell/CloseDialog'

const AntiAfk      = React.lazy(() => import('./components/macros/AntiAfk'))
const WHold        = React.lazy(() => import('./components/macros/WHold'))
const AutoClicker  = React.lazy(() => import('./components/macros/AutoClicker'))
const AutoKey      = React.lazy(() => import('./components/macros/AutoKey'))
const IracingScreenshot  = React.lazy(() => import('./components/iracing/IracingScreenshot'))
const IracingApps        = React.lazy(() => import('./components/iracing/IracingApps'))
const IniConfig          = React.lazy(() => import('./components/iracing/IniConfig'))
const MonitorTool        = React.lazy(() => import('./components/iracing/MonitorTool'))
const PatchNotes   = React.lazy(() => import('./components/shell/PatchNotes'))
const Settings     = React.lazy(() => import('./components/shell/Settings'))
const About        = React.lazy(() => import('./components/shell/About'))

function ToolFallback() {
  return (
    <div className="rounded-2xl bg-surface/5 backdrop-blur-md border border-surface/10 p-5 h-32 animate-pulse" />
  )
}

export default function App() {
  const theme = useToolStore((s) => s.theme)
  const setRunning = useToolStore((s) => s.setRunning)
  const setAfkTick = useToolStore((s) => s.setAfkTick)
  const setAutostart = useToolStore((s) => s.setAutostart)

  const [activeTool, setActiveTool] = useState<Tool>('afk')
  const [patchNotesOpen, setPatchNotesOpen] = useState(false)
  const [settingsOpen, setSettingsOpen]     = useState(false)
  const [aboutOpen, setAboutOpen]           = useState(false)
  const [closeDialogOpen, setCloseDialogOpen] = useState(false)

  const rememberCloseAction = useToolStore((s) => s.rememberCloseAction)
  const closeAction         = useToolStore((s) => s.closeAction)

  function handleClose() {
    if (rememberCloseAction) {
      if (closeAction === 'quit') window.api.windowQuit()
      else window.api.windowHide()
    } else {
      setCloseDialogOpen(true)
    }
  }

  useEffect(() => {
    const el = document.documentElement
    if (theme === 'dark') el.classList.add('dark')
    else el.classList.remove('dark')
  }, [theme])

  useEffect(() => {
    window.api.getAutostart().then(setAutostart)
  }, [setAutostart])

  useEffect(() => {
    window.api.setCloseAction(useToolStore.getState().closeAction)
  }, [])

  // Drive the iRacing app launcher app-wide (auto start/stop works even when
  // the Apps tab is not open). Re-sends only when the active profile's apps change.
  useEffect(() => {
    let last = ''
    const sync = (s: ReturnType<typeof useToolStore.getState>) => {
      const profile = s.iracingProfiles.find((p) => p.id === s.activeProfileId)
      const apps = profile?.apps ?? []
      const key = JSON.stringify(apps)
      if (key === last) return
      last = key
      window.api.appsWatch(apps)
    }
    sync(useToolStore.getState())
    return useToolStore.subscribe(sync)
  }, [])

  useEffect(() => {
    window.api.onToolStatus(({ tool, running }) => {
      setRunning(tool as Parameters<typeof setRunning>[0], running)
    })
    window.api.onAfkTick(({ remaining, presses }) => {
      setAfkTick(remaining, presses)
    })

    // Re-register persisted hotkeys after app start
    const { config } = useToolStore.getState()
    for (const [tool, cfg] of Object.entries(config)) {
      const hotkey = (cfg as Record<string, unknown>).hotkey as string | null
      if (hotkey) window.api.setHotkey(tool, hotkey)
    }

    // Toggle tool when global hotkey is pressed
    window.api.onHotkeyTrigger(({ tool }) => {
      const state = useToolStore.getState()
      const isRunning = state.running[tool as keyof typeof state.running]
      if (isRunning) {
        window.api.stopTool(tool)
      } else {
        const cfg = state.config[tool as keyof typeof state.config]
        window.api.startTool(tool, cfg as unknown as Record<string, unknown>)
      }
    })
  }, [setRunning, setAfkTick])

  return (
    <div className="flex flex-col h-screen bg-app text-muted/80 select-none">
      <TitleBar onPatchNotes={() => setPatchNotesOpen(true)} onSettings={() => setSettingsOpen(true)} onAbout={() => setAboutOpen(true)} onClose={handleClose} />
      <UpdateBadge />
      <Navbar active={activeTool} onChange={setActiveTool} />
      <main className={[
        'flex-1 overflow-y-auto',
        activeTool === 'screenshot' ? '' : 'px-4 pb-4 pt-4',

      ].join(' ')}>
        <Suspense fallback={<div className="px-4 pt-4"><ToolFallback /></div>}>
          {activeTool !== 'screenshot' && (
            <div className="max-w-lg mx-auto space-y-4">
              {activeTool === 'afk'     && <AntiAfk />}
              {activeTool === 'clicker' && <AutoClicker />}
              {activeTool === 'autokey' && <AutoKey />}
            </div>
          )}
          {activeTool === 'screenshot'      && <IracingScreenshot />}
          {activeTool === 'iracing-apps'    && <IracingApps />}
          {activeTool === 'iracing-ini'     && <IniConfig />}
          {activeTool === 'iracing-monitor' && <MonitorTool />}
        </Suspense>
      </main>
      {patchNotesOpen && (
        <Suspense fallback={null}>
          <PatchNotes onClose={() => setPatchNotesOpen(false)} />
        </Suspense>
      )}
      {settingsOpen && (
        <Suspense fallback={null}>
          <Settings onClose={() => setSettingsOpen(false)} />
        </Suspense>
      )}
      {aboutOpen && (
        <Suspense fallback={null}>
          <About onClose={() => setAboutOpen(false)} />
        </Suspense>
      )}
      {closeDialogOpen && (
        <CloseDialog onClose={() => setCloseDialogOpen(false)} />
      )}
    </div>
  )
}
