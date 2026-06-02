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
  const [icons, setIcons] = useState<Record<string, string>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})

  const loadIcon = useCallback(async (path: string) => {
    if (icons[path]) return
    const b64 = await window.api.appsGetIcon(path)
    if (b64) setIcons((prev) => ({ ...prev, [path]: b64 }))
  }, [icons])

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    window.api.iracingStatus().then(setIracingConnected)

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
    const u5 = window.api.onAppsError(({ id, message }) => {
      setErrors((prev) => ({ ...prev, [id]: message }))
    })

    const u4 = window.api.onAppsGetList(() => {
      const currentApps = useToolStore.getState().iracingApps
      window.api.appsLaunchAll(currentApps)
    })

    return () => { u1(); u2(); u3(); u4(); u5() }
  }, [])

  useEffect(() => {
    apps.forEach((a) => { void loadIcon(a.path) })
  }, [apps]) // eslint-disable-line react-hooks/exhaustive-deps

  // Register apps for status polling whenever the list changes
  useEffect(() => {
    window.api.appsWatch(apps)
  }, [apps])

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

  const startAll = useCallback(() => {
    apps.filter((a) => a.enabled && !running.has(a.id)).forEach((a) => window.api.appsLaunch(a))
  }, [apps, running])

  const stopAll = useCallback(() => {
    apps.filter((a) => running.has(a.id)).forEach((a) => window.api.appsKill(a.id))
  }, [apps, running])

  const anyRunning = apps.some((a) => running.has(a.id))

  return (
    <Panel title="Apps">
      {/* Status + Start/Stop All */}
      <div className="flex items-center justify-between mb-4">
        <div className={`flex items-center gap-2 text-xs font-mono ${iracingConnected ? 'text-success' : 'text-muted/40'}`}>
          <Circle size={7} fill="currentColor" strokeWidth={0} />
          {iracingConnected ? 'iRacing connected' : 'iRacing not running'}
        </div>
        {apps.length > 0 && (
          <div className="flex gap-2">
            <button
              onClick={startAll}
              disabled={apps.filter((a) => a.enabled).every((a) => running.has(a.id))}
              className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-success/10 border border-success/20 text-xs font-mono text-success/70 hover:bg-success/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Play size={11} /> Start All
            </button>
            <button
              onClick={stopAll}
              disabled={!anyRunning}
              className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-warn/10 border border-warn/20 text-xs font-mono text-warn/70 hover:bg-warn/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Square size={11} /> Stop All
            </button>
          </div>
        )}
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
            icon={icons[app.path] ?? null}
            error={errors[app.id] ?? null}
            onUpdate={updateApp}
            onRemove={removeApp}
            onToggleRun={(a) => { setErrors((p) => { const n = {...p}; delete n[a.id]; return n }); toggleRun(a) }}
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

function AppRow({ app, running, icon, error, onUpdate, onRemove, onToggleRun }: {
  app: IracingApp
  running: boolean
  icon: string | null
  error: string | null
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

        {/* Icon */}
        {icon ? (
          <img src={`data:image/png;base64,${icon}`} className="w-5 h-5 shrink-0 object-contain" alt="" />
        ) : (
          <div className="w-5 h-5 shrink-0 rounded bg-surface/20" />
        )}

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

        {/* Status */}
        {running && <span className="text-xs font-mono text-success/70 shrink-0">running</span>}
        {error && !running && <span className="text-xs font-mono text-warn/60 shrink-0 truncate max-w-[100px]" title={error}>error</span>}

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
