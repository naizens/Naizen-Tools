import React, { Suspense, useEffect, useState } from 'react'
import { useToolStore } from './store/toolStore'
import TitleBar from './components/ui/TitleBar'
import Navbar, { type Tool } from './components/ui/Navbar'
import UpdateBadge from './components/ui/UpdateBadge'

const AntiAfk      = React.lazy(() => import('./components/tools/AntiAfk'))
const WHold        = React.lazy(() => import('./components/tools/WHold'))
const AutoClicker  = React.lazy(() => import('./components/tools/AutoClicker'))
const AutoKey      = React.lazy(() => import('./components/tools/AutoKey'))
const GameSettings = React.lazy(() => import('./components/tools/GameSettings'))
const PatchNotes   = React.lazy(() => import('./components/tools/PatchNotes'))

function ToolFallback() {
  return (
    <div className="rounded-2xl bg-surface/5 backdrop-blur-md border border-surface/10 p-5 h-32 animate-pulse" />
  )
}

export default function App() {
  const theme = useToolStore((s) => s.theme)
  const setRunning = useToolStore((s) => s.setRunning)
  const setAfkTick = useToolStore((s) => s.setAfkTick)
  const setUpdateAvailable   = useToolStore((s) => s.setUpdateAvailable)
  const setUpdateDownloading = useToolStore((s) => s.setUpdateDownloading)
  const setUpdateReady       = useToolStore((s) => s.setUpdateReady)
  const updateAvailable = useToolStore((s) => s.updateAvailable)

  const [activeTool, setActiveTool] = useState<Tool>('afk')
  const [patchNotesOpen, setPatchNotesOpen] = useState(false)

  useEffect(() => {
    const el = document.documentElement
    if (theme === 'dark') el.classList.add('dark')
    else el.classList.remove('dark')
  }, [theme])

  useEffect(() => {
    window.api.onToolStatus(({ tool, running }) => {
      setRunning(tool as Parameters<typeof setRunning>[0], running)
    })
    window.api.onAfkTick(({ remaining, presses }) => {
      setAfkTick(remaining, presses)
    })
    window.api.onUpdateAvailable(() => setUpdateAvailable())
    window.api.onUpdateReady(() => setUpdateReady())
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window.api as any).onUpdateDownloading?.(() => setUpdateDownloading())

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
  }, [setRunning, setAfkTick, setUpdateAvailable, setUpdateDownloading, setUpdateReady])

  return (
    <div className="flex flex-col h-screen bg-app text-muted/80 select-none">
      <TitleBar onPatchNotes={() => setPatchNotesOpen(true)} />
      {updateAvailable && <UpdateBadge />}
      <Navbar active={activeTool} onChange={setActiveTool} />
      <main className="flex-1 overflow-y-auto px-4 pb-4 pt-4">
        <Suspense fallback={<ToolFallback />}>
          {activeTool === 'afk' && <AntiAfk />}
          {activeTool === 'clicker' && <AutoClicker />}
          {activeTool === 'autokey' && <AutoKey />}
          {activeTool === 'game' && <GameSettings />}
        </Suspense>
      </main>
      {patchNotesOpen && (
        <Suspense fallback={null}>
          <PatchNotes onClose={() => setPatchNotesOpen(false)} />
        </Suspense>
      )}
    </div>
  )
}
