import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronDown, Copy, FolderOpen, Pencil, Plus, Trash2, X } from 'lucide-react'
import { useToolStore, defaultApp, type IracingApp, type IracingProfile } from '@/store/toolStore'

type AppState = 'running' | 'stopped' | 'notfound'

function randomId() {
  return Math.random().toString(36).slice(2, 10)
}

// ─── Component ────────────────────────────────────────────────────────────────

export default memo(function IracingApps() {
  const profiles        = useToolStore((s) => s.iracingProfiles)
  const activeProfileId = useToolStore((s) => s.activeProfileId)
  const setProfiles     = useToolStore((s) => s.setProfiles)
  const setActiveProfile = useToolStore((s) => s.setActiveProfile)
  const setProfileApps  = useToolStore((s) => s.setProfileApps)

  const profile = profiles.find((p) => p.id === activeProfileId) ?? profiles[0]
  const apps = profile?.apps ?? []

  const [status, setStatus] = useState<Record<string, { running: boolean; exists: boolean }>>({})
  const [icons, setIcons]   = useState<Record<string, string>>({})
  const [editing, setEditing] = useState<IracingApp | null>(null)
  const [profileMenu, setProfileMenu] = useState(false)
  const [iracingConnected, setIracingConnected] = useState(false)

  // ── Status + iRacing connection ───────────────────────────────────────────
  useEffect(() => {
    window.api.iracingStatus().then(setIracingConnected)
    const u1 = window.api.onIracingConnected(() => setIracingConnected(true))
    const u2 = window.api.onIracingDisconnected(() => setIracingConnected(false))
    const u3 = window.api.onAppsStatus(({ id, running, exists }) => {
      setStatus((prev) => ({ ...prev, [id]: { running, exists } }))
    })
    return () => { u1(); u2(); u3() }
  }, [])

  // ── Load icons ────────────────────────────────────────────────────────────
  useEffect(() => {
    apps.forEach(async (a) => {
      if (!a.path || icons[a.path]) return
      const b64 = await window.api.appsGetIcon(a.path)
      if (b64) setIcons((prev) => ({ ...prev, [a.path]: b64 }))
    })
  }, [apps]) // eslint-disable-line react-hooks/exhaustive-deps

  const appState = useCallback((a: IracingApp): AppState => {
    const s = status[a.id]
    if (s?.running) return 'running'
    if (s && !s.exists) return 'notfound'
    return 'stopped'
  }, [status])

  // ── App CRUD ──────────────────────────────────────────────────────────────
  const updateApps = useCallback((next: IracingApp[]) => {
    setProfileApps(profile.id, next)
  }, [profile?.id, setProfileApps])

  const addApp = useCallback(async () => {
    const path = await window.api.appsPickExe()
    if (!path) return
    const name = (path.split(/[\\/]/).pop() ?? 'App').replace(/\.exe$/i, '')
    const app = defaultApp({ id: randomId(), name, path })
    updateApps([...apps, app])
    setEditing(app)
  }, [apps, updateApps])

  const saveApp = useCallback((app: IracingApp) => {
    updateApps(apps.map((a) => a.id === app.id ? app : a))
    setEditing(null)
  }, [apps, updateApps])

  const deleteApp = useCallback((id: string) => {
    window.api.appsKill(id)
    updateApps(apps.filter((a) => a.id !== id))
    setEditing(null)
  }, [apps, updateApps])

  const toggleRun = useCallback((a: IracingApp) => {
    if (appState(a) === 'running') window.api.appsKill(a.id)
    else window.api.appsLaunch(a.id)
  }, [appState])

  return (
    <div className="flex flex-col h-full -mx-4 -my-4">
      {/* ── Header bar ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-surface/10 bg-gradient-to-r from-accent/10 to-warn/5">
        <div className="flex items-center gap-3">
          <span className="text-sm font-mono font-bold text-muted/80 tracking-wide">iRacing Apps</span>
          <span className={`inline-flex items-center gap-1.5 text-xs font-mono ${iracingConnected ? 'text-success' : 'text-muted/40'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${iracingConnected ? 'bg-success' : 'bg-muted/30'}`} />
            {iracingConnected ? 'connected' : 'offline'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => window.api.appsStartAll()}
            className="px-3 py-1.5 rounded-md bg-success/15 border border-success/25 text-xs font-mono font-semibold text-success/80 hover:bg-success/25 transition-colors">
            Start all
          </button>
          <button onClick={() => window.api.appsStopAll()}
            className="px-3 py-1.5 rounded-md bg-warn/15 border border-warn/25 text-xs font-mono font-semibold text-warn/80 hover:bg-warn/25 transition-colors">
            Stop all
          </button>
        </div>
      </div>

      {/* ── Profile bar ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-5 py-2 border-b border-surface/10">
        <ProfileSelector
          profiles={profiles}
          activeId={activeProfileId}
          open={profileMenu}
          setOpen={setProfileMenu}
          onSelect={(id) => { setActiveProfile(id); setProfileMenu(false) }}
          onCreate={() => {
            const p: IracingProfile = { id: randomId(), name: 'New Profile', apps: [] }
            setProfiles([...profiles, p]); setActiveProfile(p.id); setProfileMenu(false)
          }}
          onRename={(name) => setProfiles(profiles.map((p) => p.id === activeProfileId ? { ...p, name } : p))}
          onDuplicate={() => {
            const p: IracingProfile = { id: randomId(), name: `${profile.name} copy`, apps: profile.apps.map((a) => ({ ...a, id: randomId() })) }
            setProfiles([...profiles, p]); setActiveProfile(p.id); setProfileMenu(false)
          }}
          onDelete={() => {
            if (profiles.length <= 1) return
            const next = profiles.filter((p) => p.id !== activeProfileId)
            setProfiles(next); setActiveProfile(next[0].id); setProfileMenu(false)
          }}
        />
        <span className="text-xs font-mono text-muted/25">{apps.length} app{apps.length !== 1 ? 's' : ''}</span>
      </div>

      {/* ── Card grid ───────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-5">
        {apps.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-muted/25">
            <Plus size={32} strokeWidth={1.5} />
            <p className="text-xs font-mono">No apps in this profile yet</p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-3">
            {apps.map((a) => (
              <AppCard
                key={a.id}
                app={a}
                state={appState(a)}
                icon={icons[a.path] ?? null}
                onToggle={() => toggleRun(a)}
                onEdit={() => setEditing(a)}
              />
            ))}
            <button onClick={addApp}
              className="w-[230px] h-[104px] rounded-lg border border-dashed border-surface/20 flex flex-col items-center justify-center gap-1.5 text-muted/30 hover:border-accent/30 hover:text-accent/60 transition-colors">
              <Plus size={20} />
              <span className="text-xs font-mono">Add application</span>
            </button>
          </div>
        )}
      </div>

      {/* ── Edit modal ──────────────────────────────────────────────────────── */}
      {editing && (
        <AppEditModal
          app={editing}
          onSave={saveApp}
          onDelete={() => deleteApp(editing.id)}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
})

// ─── App card ─────────────────────────────────────────────────────────────────

function AppCard({ app, state, icon, onToggle, onEdit }: {
  app: IracingApp
  state: AppState
  icon: string | null
  onToggle: () => void
  onEdit: () => void
}) {
  const [hover, setHover] = useState(false)

  const button = (() => {
    if (state === 'notfound') return { label: 'NOT FOUND', cls: 'bg-surface/15 text-muted/40 cursor-not-allowed' }
    if (state === 'running') return {
      label: hover ? 'STOP' : 'RUNNING',
      cls: hover ? 'bg-warn/80 text-white' : 'bg-success/70 text-white',
    }
    return { label: 'START', cls: 'bg-surface/20 text-muted/70 hover:bg-surface/30' }
  })()

  return (
    <div className="w-[230px] h-[104px] rounded-lg bg-surface/10 border border-surface/10 overflow-hidden flex flex-col">
      {/* Top: icon + name + edit */}
      <div className="flex items-center gap-3 px-3 pt-3 flex-1 min-h-0">
        {icon ? (
          <img src={`data:image/png;base64,${icon}`} className="w-9 h-9 shrink-0 object-contain" alt="" />
        ) : (
          <div className="w-9 h-9 shrink-0 rounded bg-surface/20" />
        )}
        <p className="flex-1 text-sm font-mono font-semibold text-muted/80 truncate">{app.name}</p>
        <button onClick={onEdit} className="text-muted/25 hover:text-muted/60 transition-colors shrink-0">
          <Pencil size={13} />
        </button>
      </div>
      {/* Bottom: state button */}
      <button
        onClick={() => state !== 'notfound' && onToggle()}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        className={`mx-3 mb-3 mt-2 py-1.5 rounded-md text-xs font-mono font-bold tracking-wide transition-colors ${button.cls}`}
      >
        {button.label}
      </button>
    </div>
  )
}

// ─── Profile selector ─────────────────────────────────────────────────────────

function ProfileSelector({ profiles, activeId, open, setOpen, onSelect, onCreate, onRename, onDuplicate, onDelete }: {
  profiles: IracingProfile[]
  activeId: string
  open: boolean
  setOpen: (v: boolean) => void
  onSelect: (id: string) => void
  onCreate: () => void
  onRename: (name: string) => void
  onDuplicate: () => void
  onDelete: () => void
}) {
  const active = profiles.find((p) => p.id === activeId)
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState(active?.name ?? '')

  if (renaming) {
    return (
      <input
        autoFocus value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => { if (name.trim()) onRename(name.trim()); setRenaming(false) }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { if (name.trim()) onRename(name.trim()); setRenaming(false) }
          if (e.key === 'Escape') setRenaming(false)
        }}
        className="bg-surface/10 border border-accent/40 rounded-md px-3 h-7 text-xs font-mono text-muted/70 focus:outline-none w-40"
      />
    )
  }

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 h-7 rounded-md bg-surface/10 border border-surface/15 text-xs font-mono text-muted/70 hover:border-surface/30 transition-colors">
        {active?.name ?? 'Profile'}
        <ChevronDown size={11} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 w-52 rounded-md bg-app border border-surface/15 shadow-xl overflow-hidden z-50">
          {profiles.map((p) => (
            <button key={p.id} onClick={() => onSelect(p.id)}
              className={`w-full text-left px-3 py-2 text-xs font-mono transition-colors ${p.id === activeId ? 'text-accent bg-accent/10' : 'text-muted/50 hover:bg-surface/10'}`}>
              {p.name}
            </button>
          ))}
          <div className="border-t border-surface/10">
            <MenuItem icon={<Plus size={12} />} label="New profile" onClick={onCreate} />
            <MenuItem icon={<Pencil size={12} />} label="Rename" onClick={() => { setName(active?.name ?? ''); setRenaming(true); setOpen(false) }} />
            <MenuItem icon={<Copy size={12} />} label="Duplicate" onClick={onDuplicate} />
            {profiles.length > 1 && <MenuItem icon={<Trash2 size={12} />} label="Delete" danger onClick={onDelete} />}
          </div>
        </div>
      )}
    </div>
  )
}

function MenuItem({ icon, label, onClick, danger }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick}
      className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-mono transition-colors ${danger ? 'text-warn/60 hover:text-warn hover:bg-warn/10' : 'text-muted/50 hover:text-muted/80 hover:bg-surface/10'}`}>
      {icon} {label}
    </button>
  )
}

// ─── Edit modal ───────────────────────────────────────────────────────────────

function AppEditModal({ app, onSave, onDelete, onClose }: {
  app: IracingApp
  onSave: (a: IracingApp) => void
  onDelete: () => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState<IracingApp>(app)
  const set = (patch: Partial<IracingApp>) => setDraft((d) => ({ ...d, ...patch }))

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  const conditions = useMemo(() => ([
    { key: 'startWithSim', label: 'Start with iRacing Sim' },
    { key: 'stopWithSim',  label: 'Stop with iRacing Sim' },
    { key: 'startWithUi',  label: 'Start with iRacing UI' },
    { key: 'stopWithUi',   label: 'Stop with iRacing UI' },
    { key: 'startHidden',  label: 'Start hidden' },
    { key: 'includeInStartAll', label: 'Include in "Start all"' },
    { key: 'includeInStopAll',  label: 'Include in "Stop all"' },
  ] as const), [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="relative w-full max-w-md mx-4 rounded-lg bg-surface/8 backdrop-blur-xl border border-surface/12 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface/10 shrink-0">
          <span className="text-sm font-semibold text-muted/80">Edit Application</span>
          <button onClick={onClose} className="w-7 h-7 rounded-md flex items-center justify-center text-muted/30 hover:text-muted/70 hover:bg-surface/10 transition-colors">
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {/* Name */}
          <div>
            <p className="text-xs font-mono text-muted/40 mb-1">Name</p>
            <input value={draft.name} maxLength={30} onChange={(e) => set({ name: e.target.value })}
              className="w-full bg-surface/10 border border-surface/15 rounded-md px-3 h-9 text-xs font-mono text-muted/70 focus:outline-none focus:border-accent/40" />
          </div>

          {/* Path */}
          <div>
            <p className="text-xs font-mono text-muted/40 mb-1">Application</p>
            <div className="flex gap-2">
              <input readOnly value={draft.path}
                className="flex-1 min-w-0 bg-surface/10 border border-surface/15 rounded-md px-3 h-9 text-xs font-mono text-muted/50 cursor-default" />
              <button onClick={async () => { const p = await window.api.appsPickExe(); if (p) set({ path: p, name: draft.name || (p.split(/[\\/]/).pop() ?? '').replace(/\.exe$/i, '') }) }}
                className="w-9 h-9 shrink-0 rounded-md bg-surface/10 border border-surface/15 text-muted/40 hover:text-muted/80 transition-colors flex items-center justify-center">
                <FolderOpen size={14} />
              </button>
            </div>
          </div>

          {/* Arguments */}
          <div>
            <p className="text-xs font-mono text-muted/40 mb-1">Arguments (optional)</p>
            <input value={draft.args} onChange={(e) => set({ args: e.target.value })}
              placeholder="--flag --option value"
              className="w-full bg-surface/10 border border-surface/15 rounded-md px-3 h-9 text-xs font-mono text-muted/70 focus:outline-none focus:border-accent/40" />
          </div>

          {/* Conditions */}
          <div className="space-y-2 pt-1">
            {conditions.map(({ key, label }) => (
              <label key={key} className="flex items-center justify-between cursor-pointer">
                <span className="text-xs font-mono text-muted/60">{label}</span>
                <button onClick={() => set({ [key]: !draft[key] } as Partial<IracingApp>)}
                  className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${draft[key] ? 'bg-accent/30' : 'bg-muted/20'}`}>
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full transition-all ${draft[key] ? 'left-4 bg-accent' : 'left-0.5 bg-muted/50'}`} />
                </button>
              </label>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-surface/10 flex items-center justify-between shrink-0">
          <button onClick={onDelete}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono text-warn/60 hover:text-warn hover:bg-warn/10 transition-colors">
            <Trash2 size={12} /> Delete
          </button>
          <div className="flex gap-2">
            <button onClick={onClose}
              className="px-4 py-1.5 rounded-md border border-surface/15 text-xs font-mono text-muted/50 hover:text-muted/80 hover:bg-surface/10 transition-colors">
              Cancel
            </button>
            <button onClick={() => onSave(draft)}
              className="px-4 py-1.5 rounded-md bg-accent/20 border border-accent/30 text-xs font-mono font-semibold text-accent hover:bg-accent/30 transition-colors">
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
