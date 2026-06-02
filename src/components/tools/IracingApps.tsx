import { memo, useCallback, useEffect, useState } from 'react'
import { Circle, FolderOpen, Play, Plus, Square, Trash2 } from 'lucide-react'
import { useToolStore, type IracingApp } from '@/store/toolStore'
import Panel from '@/components/ui/Panel'

function randomId() {
  return Math.random().toString(36).slice(2, 10)
}

export default memo(function IracingApps() {
  const apps    = useToolStore((s) => s.iracingApps)
  const setApps = useToolStore((s) => s.setIracingApps)

  const [running, setRunning] = useState<Set<string>>(new Set())
  const [iracingConnected, setIracingConnected] = useState(false)

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    window.api.iracingStatus().then(setIracingConnected)
    window.api.appsRunning().then((ids) => setRunning(new Set(ids)))

    const u1 = window.api.onIracingConnected(() => setIracingConnected(true))
    const u2 = window.api.onIracingDisconnected(() => {
      setIracingConnected(false)
      setRunning(new Set())
    })
    const u3 = window.api.onAppsStatus(({ id, running: r }) => {
      setRunning((prev) => {
        const next = new Set(prev)
        r ? next.add(id) : next.delete(id)
        return next
      })
    })
    // When iRacing connects, main asks renderer for the app list to auto-launch
    const u4 = window.api.onAppsGetList(() => {
      const currentApps = useToolStore.getState().iracingApps
      window.api.appsLaunchAll(currentApps)
    })

    return () => { u1(); u2(); u3(); u4() }
  }, [])

  // ── App management ────────────────────────────────────────────────────────
  const addApp = useCallback(async () => {
    const path = await window.api.appsPickExe()
    if (!path) return
    const name = path.split(/[\\/]/).pop()?.replace('.exe', '') ?? 'App'
    setApps([...apps, { id: randomId(), name, path, args: '', enabled: true }])
  }, [apps, setApps])

  const removeApp = useCallback((id: string) => {
    window.api.appsKill(id)
    setApps(apps.filter((a) => a.id !== id))
  }, [apps, setApps])

  const updateApp = useCallback((id: string, patch: Partial<IracingApp>) => {
    setApps(apps.map((a) => a.id === id ? { ...a, ...patch } : a))
  }, [apps, setApps])

  const toggleRun = useCallback((app: IracingApp) => {
    if (running.has(app.id)) {
      window.api.appsKill(app.id)
    } else {
      window.api.appsLaunch(app)
    }
  }, [running])

  return (
    <Panel title="Apps">
      {/* Status */}
      <div className={`flex items-center gap-2 text-xs font-mono mb-4 ${iracingConnected ? 'text-success' : 'text-muted/40'}`}>
        <Circle size={7} fill="currentColor" strokeWidth={0} />
        {iracingConnected ? 'iRacing connected — apps launch automatically' : 'iRacing not running'}
      </div>

      {/* App list */}
      <div className="space-y-2 mb-4">
        {apps.length === 0 && (
          <p className="text-xs font-mono text-muted/30 text-center py-6">
            No apps configured. Add an app to get started.
          </p>
        )}
        {apps.map((app) => (
          <AppRow
            key={app.id}
            app={app}
            running={running.has(app.id)}
            onUpdate={updateApp}
            onRemove={removeApp}
            onToggleRun={toggleRun}
          />
        ))}
      </div>

      {/* Add button */}
      <button
        onClick={addApp}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-md border border-dashed border-surface/20 text-xs font-mono text-muted/40 hover:border-accent/30 hover:text-accent/60 transition-colors"
      >
        <Plus size={13} />
        Add Application
      </button>
    </Panel>
  )
})

// ─── App row ──────────────────────────────────────────────────────────────────

function AppRow({ app, running, onUpdate, onRemove, onToggleRun }: {
  app: IracingApp
  running: boolean
  onUpdate: (id: string, patch: Partial<IracingApp>) => void
  onRemove: (id: string) => void
  onToggleRun: (app: IracingApp) => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className={`rounded-md border transition-colors ${running ? 'border-success/20 bg-success/5' : 'border-surface/10 bg-surface/5'}`}>
      <div className="flex items-center gap-2 px-3 py-2.5">
        {/* Enabled toggle */}
        <button
          onClick={() => onUpdate(app.id, { enabled: !app.enabled })}
          className={`relative w-8 h-4 rounded-full transition-colors shrink-0 ${app.enabled ? 'bg-accent/30' : 'bg-muted/20'}`}
        >
          <span className={`absolute top-0.5 w-3 h-3 rounded-full transition-all ${app.enabled ? 'left-4 bg-accent' : 'left-0.5 bg-muted/50'}`} />
        </button>

        {/* Name */}
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex-1 text-left min-w-0"
        >
          <p className={`text-xs font-mono font-semibold truncate ${app.enabled ? 'text-muted/80' : 'text-muted/30'}`}>
            {app.name}
          </p>
          <p className="text-xs font-mono text-muted/25 truncate">{app.path}</p>
        </button>

        {/* Running status */}
        {running && (
          <span className="text-xs font-mono text-success/70 shrink-0">running</span>
        )}

        {/* Launch/Stop button */}
        <button
          onClick={() => onToggleRun(app)}
          className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors shrink-0 ${
            running
              ? 'text-warn/60 hover:text-warn hover:bg-warn/10'
              : 'text-muted/30 hover:text-success hover:bg-success/10'
          }`}
          title={running ? 'Stop' : 'Launch'}
        >
          {running ? <Square size={12} /> : <Play size={12} />}
        </button>

        {/* Delete */}
        <button
          onClick={() => onRemove(app.id)}
          className="w-7 h-7 rounded-md flex items-center justify-center text-muted/20 hover:text-warn hover:bg-warn/10 transition-colors shrink-0"
          title="Remove"
        >
          <Trash2 size={12} />
        </button>
      </div>

      {/* Expanded — edit name, path, args */}
      {expanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-surface/10 pt-2">
          <div>
            <p className="text-xs font-mono text-muted/30 mb-1">Display name</p>
            <input
              value={app.name}
              onChange={(e) => onUpdate(app.id, { name: e.target.value })}
              className="w-full bg-surface/10 border border-surface/15 rounded-md px-3 h-8 text-xs font-mono text-muted/70 focus:outline-none focus:border-accent/40"
            />
          </div>
          <div>
            <p className="text-xs font-mono text-muted/30 mb-1">Path</p>
            <div className="flex gap-1.5">
              <input
                readOnly value={app.path}
                className="flex-1 min-w-0 bg-surface/10 border border-surface/15 rounded-md px-3 h-8 text-xs font-mono text-muted/50 cursor-default"
              />
              <button
                onClick={async () => {
                  const p = await window.api.appsPickExe()
                  if (p) onUpdate(app.id, { path: p })
                }}
                className="w-8 h-8 shrink-0 rounded-md bg-surface/10 border border-surface/15 text-muted/40 hover:text-muted/80 transition-colors flex items-center justify-center"
              >
                <FolderOpen size={12} />
              </button>
            </div>
          </div>
          <div>
            <p className="text-xs font-mono text-muted/30 mb-1">Arguments (optional)</p>
            <input
              value={app.args}
              onChange={(e) => onUpdate(app.id, { args: e.target.value })}
              placeholder="--minimized --flag"
              className="w-full bg-surface/10 border border-surface/15 rounded-md px-3 h-8 text-xs font-mono text-muted/70 focus:outline-none focus:border-accent/40"
            />
          </div>
        </div>
      )}
    </div>
  )
}
