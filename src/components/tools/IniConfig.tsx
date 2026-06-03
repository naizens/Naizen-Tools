import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, ArrowDown, ArrowUp, Check, FileText, FolderOpen, Pencil, Plus, RefreshCw, Save, Settings, Trash2, X } from 'lucide-react'
import { useToolStore } from '@/store/toolStore'

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function computeMatches(text: string, q: string): number[] {
  if (!q) return []
  const out: number[] = []
  const hay = text.toLowerCase(), needle = q.toLowerCase()
  let i = hay.indexOf(needle)
  while (i !== -1) { out.push(i); i = hay.indexOf(needle, i + Math.max(1, needle.length)) }
  return out
}

interface IniProfile { id: string; name: string; slug: string; files: string[]; savedAt: number }

function sourceName(target: string, slug: string): string {
  const dot = target.lastIndexOf('.')
  const stem = dot >= 0 ? target.slice(0, dot) : target
  const ext  = dot >= 0 ? target.slice(dot) : ''
  return `${stem}_${slug}${ext}`
}

function fmtDate(ts: number) {
  return new Date(ts).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
}

// ─── Main component ───────────────────────────────────────────────────────────

export default memo(function IniConfig() {
  const folder         = useToolStore((s) => s.iniFolder)
  const setFolder      = useToolStore((s) => s.setIniFolder)
  const activeId       = useToolStore((s) => s.iniActiveProfileId)
  const setActiveId    = useToolStore((s) => s.setIniActiveProfile)
  const managedFiles   = useToolStore((s) => s.iniManagedFiles)
  const setManagedFiles = useToolStore((s) => s.setIniManagedFiles)

  const [files, setFiles]   = useState<string[]>([])
  const [mtimes, setMtimes] = useState<Record<string, number>>({})
  const [selected, setSelected] = useState<string | null>(null)
  const [content, setContent]   = useState('')
  const [profiles, setProfiles] = useState<IniProfile[]>([])

  const [saving, setSaving]         = useState(false)
  const [editProfile, setEditProfile] = useState<IniProfile | null>(null)
  const [showManagedSettings, setShowManagedSettings] = useState(false)
  const [toast, setToast]           = useState<string | null>(null)
  const [applying, setApplying]     = useState<string | null>(null)

  // unsaved-changes warning state
  const [pendingApply, setPendingApply] = useState<IniProfile | null>(null)
  const [changedFiles, setChangedFiles] = useState<string[]>([])

  // file editing
  const [editing, setEditing]   = useState(false)
  const [draft, setDraft]       = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  // find-in-editor (Ctrl+F)
  const [findOpen, setFindOpen]   = useState(false)
  const [findQuery, setFindQuery] = useState('')
  const [findIdx, setFindIdx]     = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const highlightRef = useRef<HTMLDivElement>(null)
  const lineNumRef   = useRef<HTMLDivElement>(null)
  const findInputRef = useRef<HTMLInputElement>(null)
  const [gutterStyle, setGutterStyle] = useState({ lineHeight: '20px', paddingTop: '16px', paddingBottom: '16px' })
  const matches = findOpen ? computeMatches(draft, findQuery) : []

  const highlightedHtml = useMemo(() => {
    if (!findOpen || !matches.length || !findQuery) return ''
    const qLen = findQuery.length
    const parts: string[] = []
    let pos = 0
    matches.forEach((start, i) => {
      if (start > pos) parts.push(escapeHtml(draft.slice(pos, start)))
      const bg = i === findIdx ? 'rgba(139,92,246,0.45)' : 'rgba(139,92,246,0.18)'
      parts.push(`<mark style="background:${bg};border-radius:2px">${escapeHtml(draft.slice(start, start + qLen))}</mark>`)
      pos = start + qLen
    })
    if (pos < draft.length) parts.push(escapeHtml(draft.slice(pos)))
    return parts.join('')
  }, [findOpen, draft, matches, findIdx, findQuery])

  const goToMatch = useCallback((idx: number, ms: number[], query: string) => {
    const ta = textareaRef.current
    if (!ta || ms.length === 0) return
    const clamped = (idx + ms.length) % ms.length
    setFindIdx(clamped)
    const start = ms[clamped]
    ta.focus()
    ta.setSelectionRange(start, start + query.length)
    const line = draft.slice(0, start).split('\n').length
    const cs = getComputedStyle(ta)
    const lh = parseFloat(cs.lineHeight) || 18
    const pad = parseFloat(cs.paddingTop) || 0
    ta.scrollTop = Math.max(0, (line - 1) * lh + pad - ta.clientHeight / 2)
    findInputRef.current?.focus()
  }, [draft])

  const openFind = useCallback(() => {
    const ta = textareaRef.current
    const sel = ta && ta.selectionStart !== ta.selectionEnd
      ? draft.slice(ta.selectionStart, ta.selectionEnd) : ''
    if (sel && !sel.includes('\n')) setFindQuery(sel)
    setFindOpen(true)
    setTimeout(() => findInputRef.current?.select(), 0)
  }, [draft])

  // Measure textarea's actual computed line-height when editor opens
  useEffect(() => {
    if (!editing) return
    requestAnimationFrame(() => {
      const ta = textareaRef.current
      if (!ta) return
      const cs = getComputedStyle(ta)
      setGutterStyle({ lineHeight: cs.lineHeight, paddingTop: cs.paddingTop, paddingBottom: cs.paddingBottom })
    })
  }, [editing])

  // jump to first match when the query changes
  useEffect(() => {
    if (findOpen && findQuery) {
      const ms = computeMatches(draft, findQuery)
      if (ms.length) goToMatch(0, ms, findQuery)
    }
  }, [findQuery]) // eslint-disable-line react-hooks/exhaustive-deps

  const flash = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500) }

  const refresh = useCallback(async (f: string) => {
    const fs = await window.api.iniListFiles(f)
    setFiles(fs)
    setMtimes(await window.api.iniMtimes(f))
    setProfiles(await window.api.iniListProfiles())
    setSelected((cur) => cur && fs.includes(cur) ? cur : fs[0] ?? null)
  }, [])

  useEffect(() => {
    (async () => {
      let f = folder
      if (!f) { f = await window.api.iniDetectFolder(); setFolder(f) }
      await window.api.iniMigrate(f)   // repair old crossed/shared mappings once
      await refresh(f)
    })()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setEditing(false)
    setConfirmDelete(false)
    setFindOpen(false)
    if (!selected || !folder) { setContent(''); return }
    window.api.iniReadFile(folder, selected).then(setContent)
  }, [selected, folder])

  const saveEdit = async () => {
    if (!selected) return
    const ok = await window.api.iniWriteFile(folder, selected, draft)
    if (ok) { setContent(draft); setEditing(false); flash(`Saved ${selected}`) }
    else flash('Save failed')
  }

  const deleteFile = async () => {
    if (!selected) return
    const ok = await window.api.iniDeleteFile(folder, selected)
    setConfirmDelete(false)
    if (ok) { flash(`Deleted ${selected}`); setSelected(null); refresh(folder) }
    else flash('Delete failed')
  }

  const pickFolder = async () => {
    const f = await window.api.iniPickFolder()
    if (f) { setFolder(f); await refresh(f) }
  }

  // Update active profile with current live files (no warning needed — user is explicitly updating)
  const updateActiveProfile = async () => {
    const active = profiles.find((p) => p.id === activeId)
    if (!active) return
    await window.api.iniUpdate(active.id, folder, managedFiles)
    flash(`Updated "${active.name}"`)
    await refresh(folder)
  }

  // Apply: check for unsaved changes first
  const requestApply = async (p: IniProfile) => {
    if (activeId && activeId !== p.id) {
      const { changed } = await window.api.iniCompare(activeId, folder)
      if (changed.length > 0) {
        setChangedFiles(changed)
        setPendingApply(p)
        return
      }
    }
    doApply(p)
  }

  const doApply = async (p: IniProfile) => {
    setApplying(p.id)
    const res = await window.api.iniApply(p.id, folder)
    setActiveId(p.id)
    setApplying(null)
    setPendingApply(null)
    flash(res.failed.length ? `Applied "${p.name}" — ${res.failed.length} failed` : `Switched to "${p.name}"`)
    if (selected) window.api.iniReadFile(folder, selected).then(setContent)
    setMtimes(await window.api.iniMtimes(folder))
  }

  const updateThenApply = async () => {
    const active = profiles.find((p) => p.id === activeId)
    if (active) await window.api.iniUpdate(active.id, folder, managedFiles)
    if (pendingApply) await doApply(pendingApply)
    await refresh(folder)
  }

  const activeProfile = profiles.find((p) => p.id === activeId)

  return (
    <div className="flex flex-col h-full -mx-4 -my-4">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-surface/10">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-xs font-mono font-semibold text-muted/40 tracking-widest uppercase shrink-0">iRacing Config</span>
          <span className="w-px h-4 bg-surface/15 shrink-0" />
          <span className="text-xs font-mono text-muted/40 truncate" title={folder}>{folder || '—'}</span>
          <button onClick={pickFolder} title="Change folder" className="text-muted/30 hover:text-muted/60 transition-colors shrink-0"><FolderOpen size={13} /></button>
          <button onClick={() => refresh(folder)} title="Refresh" className="text-muted/30 hover:text-muted/60 transition-colors shrink-0"><RefreshCw size={12} /></button>
          <button onClick={() => setShowManagedSettings(true)} title="Managed files settings" className="text-muted/30 hover:text-muted/60 transition-colors shrink-0"><Settings size={12} /></button>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {activeProfile && (
            <button onClick={updateActiveProfile}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-surface/10 border border-surface/15 text-xs font-mono font-semibold text-muted/60 hover:text-muted/90 hover:bg-surface/20 transition-colors"
              title={`Update "${activeProfile.name}" with current live files`}>
              <Save size={12} /> Update "{activeProfile.name}"
            </button>
          )}
          <button onClick={() => setSaving(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-accent/20 border border-accent/30 text-xs font-mono font-semibold text-accent hover:bg-accent/30 transition-colors">
            <Plus size={12} /> New profile
          </button>
        </div>
      </div>

      {/* Two-pane */}
      <div className="flex-1 flex min-h-0">
        {/* Left navbar */}
        <div className="w-64 shrink-0 border-r border-surface/10 overflow-y-auto flex flex-col">
          {/* Profiles */}
          <div className="px-3 pt-3 pb-1">
            <span className="text-xs font-mono font-semibold text-muted/30 tracking-wider uppercase">Profiles</span>
          </div>
          {profiles.length === 0 ? (
            <button onClick={() => setSaving(true)}
              className="flex flex-col items-center gap-1.5 py-4 text-muted/25 hover:text-accent/60 transition-colors w-full">
              <Plus size={18} />
              <span className="text-xs font-mono">Save first profile</span>
            </button>
          ) : (
            <div className="px-2 space-y-1 mb-3">
              {profiles.map((p) => (
                <div key={p.id}
                  className={[
                    'flex items-center gap-1 rounded-md border transition-colors pr-1',
                    activeId === p.id ? 'bg-accent/10 border-accent/30' : 'bg-surface/5 border-transparent hover:bg-surface/10',
                  ].join(' ')}>
                  <button onClick={() => requestApply(p)} className="flex-1 flex items-center gap-2 px-2.5 py-2.5 text-left min-w-0">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${activeId === p.id ? 'bg-accent' : 'bg-muted/25'}`} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-mono font-semibold truncate ${activeId === p.id ? 'text-accent' : 'text-muted/70'}`}>{p.name}</p>
                      <p className="text-xs font-mono text-muted/25"
                        title={p.files.map((t) => `${sourceName(t, p.slug)} → ${t}`).join('\n')}>{p.files.length} files · {fmtDate(p.savedAt)}</p>
                    </div>
                    {applying === p.id && <RefreshCw size={11} className="text-accent animate-spin shrink-0" />}
                  </button>
                  <button onClick={() => setEditProfile(p)}
                    className="w-7 h-7 rounded flex items-center justify-center text-muted/30 hover:text-muted/70 hover:bg-surface/15 transition-colors shrink-0">
                    <Pencil size={12} />
                  </button>
                  <button onClick={async () => { await window.api.iniDelete(p.id); if (activeId === p.id) setActiveId(''); refresh(folder) }}
                    className="w-7 h-7 rounded flex items-center justify-center text-muted/30 hover:text-warn hover:bg-warn/10 transition-colors shrink-0">
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Files */}
          <div className="px-3 pt-2 pb-1 border-t border-surface/10">
            <span className="text-xs font-mono font-semibold text-muted/30 tracking-wider uppercase">Files</span>
          </div>
          <div className="pb-3">
            {files.map((f) => (
              <button key={f} onClick={() => setSelected(f)}
                title={`${f}${mtimes[f] ? `\nLast modified: ${fmtDate(mtimes[f])}` : ''}`}
                className={[
                  'w-full flex items-center gap-2 px-4 py-1.5 text-left text-xs font-mono transition-colors border-l-2',
                  selected === f ? 'text-accent bg-accent/10 border-accent' : 'text-muted/50 hover:text-muted/80 hover:bg-surface/10 border-transparent',
                ].join(' ')}>
                <FileText size={11} className="shrink-0 opacity-50" />
                <span className="truncate">{f}</span>
                {managedFiles.includes(f) && <span className="shrink-0 w-1 h-1 rounded-full bg-accent/40" title="Managed by profiles" />}
              </button>
            ))}
          </div>
        </div>

        {/* Right: preview */}
        <div className="flex-1 flex flex-col min-w-0">
          {selected ? (
            <>
              <div className="px-4 py-2 border-b border-surface/10 flex items-center gap-2">
                <FileText size={12} className="text-muted/30" />
                <span className="text-xs font-mono text-muted/60"
                  title={`${selected}${mtimes[selected] ? `\nLast modified: ${fmtDate(mtimes[selected])}` : ''}`}>{selected}</span>
                <span className="text-xs font-mono text-muted/20">· {(editing ? draft : content).split('\n').length} lines</span>
                <div className="ml-auto flex items-center gap-1.5">
                  {editing ? (
                    <>
                      <button onClick={() => setEditing(false)}
                        className="px-2.5 py-1 rounded-md border border-surface/15 text-xs font-mono text-muted/50 hover:text-muted/80 hover:bg-surface/10 transition-colors">Cancel</button>
                      <button onClick={saveEdit}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-accent/20 border border-accent/30 text-xs font-mono font-semibold text-accent hover:bg-accent/30 transition-colors">
                        <Save size={11} /> Save
                      </button>
                    </>
                  ) : confirmDelete ? (
                    <>
                      <span className="text-xs font-mono text-warn/70">Delete {selected}?</span>
                      <button onClick={() => setConfirmDelete(false)}
                        className="px-2.5 py-1 rounded-md border border-surface/15 text-xs font-mono text-muted/50 hover:text-muted/80 hover:bg-surface/10 transition-colors">No</button>
                      <button onClick={deleteFile}
                        className="px-2.5 py-1 rounded-md bg-warn/20 border border-warn/30 text-xs font-mono font-semibold text-warn hover:bg-warn/30 transition-colors">Delete</button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => { setDraft(content); setEditing(true) }}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-surface/15 text-xs font-mono text-muted/50 hover:text-muted/80 hover:bg-surface/10 transition-colors">
                        <Pencil size={11} /> Edit
                      </button>
                      <button onClick={() => setConfirmDelete(true)}
                        className="w-7 h-7 rounded-md flex items-center justify-center text-muted/25 hover:text-warn hover:bg-warn/10 transition-colors" title="Delete file">
                        <Trash2 size={12} />
                      </button>
                    </>
                  )}
                </div>
              </div>
              {editing ? (
                <div className="relative flex-1 min-h-0 flex flex-col">
                  {findOpen && (
                    <div className="absolute top-2 right-3 z-10 flex items-center gap-1 px-2 py-1 rounded-md bg-app border border-surface/20 shadow-xl">
                      <input
                        ref={findInputRef}
                        value={findQuery}
                        onChange={(e) => setFindQuery(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') { e.preventDefault(); goToMatch(findIdx + (e.shiftKey ? -1 : 1), matches, findQuery) }
                          if (e.key === 'Escape') { e.preventDefault(); setFindOpen(false); textareaRef.current?.focus() }
                        }}
                        placeholder="Find"
                        className="w-36 bg-transparent text-xs font-mono text-muted/70 focus:outline-none placeholder:text-muted/30"
                      />
                      <span className="text-xs font-mono text-muted/30 tabular-nums px-1">
                        {matches.length ? `${findIdx + 1}/${matches.length}` : findQuery ? '0/0' : ''}
                      </span>
                      <button onClick={() => goToMatch(findIdx - 1, matches, findQuery)} disabled={!matches.length}
                        className="w-5 h-5 rounded flex items-center justify-center text-muted/40 hover:text-muted/80 hover:bg-surface/10 transition-colors disabled:opacity-30"><ArrowUp size={11} /></button>
                      <button onClick={() => goToMatch(findIdx + 1, matches, findQuery)} disabled={!matches.length}
                        className="w-5 h-5 rounded flex items-center justify-center text-muted/40 hover:text-muted/80 hover:bg-surface/10 transition-colors disabled:opacity-30"><ArrowDown size={11} /></button>
                      <button onClick={() => { setFindOpen(false); textareaRef.current?.focus() }}
                        className="w-5 h-5 rounded flex items-center justify-center text-muted/40 hover:text-muted/80 hover:bg-surface/10 transition-colors"><X size={11} /></button>
                    </div>
                  )}
                  <div className="flex flex-1 min-h-0 overflow-hidden">
                    {/* Line number gutter — single text block to avoid sub-pixel drift */}
                    <div
                      ref={lineNumRef}
                      aria-hidden
                      className="shrink-0 overflow-hidden select-none border-r border-surface/10 pr-3 text-right text-xs font-mono whitespace-pre text-muted/20"
                      style={{ width: 44, ...gutterStyle }}
                    >
                      {draft.split('\n').map((_, i) => i + 1).join('\n')}
                    </div>
                    {/* Editor */}
                    <div className="relative flex-1 min-h-0">
                      {highlightedHtml && (
                        <div
                          ref={highlightRef}
                          aria-hidden
                          dangerouslySetInnerHTML={{ __html: highlightedHtml }}
                          className="absolute inset-0 pt-4 pb-4 pr-4 pl-3 text-xs font-mono leading-5 whitespace-pre overflow-auto pointer-events-none [color:transparent] [&::-webkit-scrollbar]:hidden"
                        />
                      )}
                      <textarea ref={textareaRef} value={draft} onChange={(e) => setDraft(e.target.value)} spellCheck={false}
                        onScroll={() => {
                          const ta = textareaRef.current
                          if (!ta) return
                          if (highlightRef.current) {
                            highlightRef.current.scrollTop  = ta.scrollTop
                            highlightRef.current.scrollLeft = ta.scrollLeft
                          }
                          if (lineNumRef.current) {
                            const gutter = lineNumRef.current
                            const taMax  = ta.scrollHeight - ta.clientHeight
                            const gutMax = gutter.scrollHeight - gutter.clientHeight
                            gutter.scrollTop = taMax > 0 ? ta.scrollTop * gutMax / taMax : ta.scrollTop
                          }
                        }}
                        onKeyDown={(e) => {
                          if ((e.ctrlKey || e.metaKey) && e.key === 'f') { e.preventDefault(); openFind() }
                        }}
                        className="absolute inset-0 pt-4 pb-4 pr-4 pl-3 text-xs font-mono text-muted/70 leading-5 bg-transparent resize-none focus:outline-none whitespace-pre [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-surface/30 [&::-webkit-scrollbar-track]:bg-transparent" />
                    </div>
                  </div>
                </div>
              ) : (
                <pre className="flex-1 overflow-auto p-4 text-xs font-mono text-muted/60 leading-relaxed whitespace-pre [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-surface/30 [&::-webkit-scrollbar-track]:bg-transparent">
                  {content || <span className="text-muted/25">Empty file</span>}
                </pre>
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted/20">
              <p className="text-xs font-mono">Select a file to preview</p>
            </div>
          )}
        </div>
      </div>

      {toast && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-md bg-app border border-surface/20 shadow-xl text-xs font-mono text-muted/70 pointer-events-none">
          {toast}
        </div>
      )}

      {/* Unsaved-changes warning */}
      {pendingApply && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm mx-4 rounded-lg bg-surface/8 backdrop-blur-xl border border-surface/12 shadow-2xl p-6 space-y-4">
            <div className="flex items-start gap-3">
              <AlertTriangle size={18} className="text-amber/70 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-muted/80 mb-1">Unsaved changes</p>
                <p className="text-xs font-mono text-muted/50">
                  {`"${activeProfile?.name}" has unsaved changes in: `}
                  <span className="text-amber/70">{changedFiles.join(', ')}</span>
                  {'. Switching will overwrite them.'}
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <button onClick={updateThenApply}
                className="w-full py-2 rounded-md bg-accent/20 border border-accent/30 text-xs font-mono font-semibold text-accent hover:bg-accent/30 transition-colors">
                Update "{activeProfile?.name}" first, then switch
              </button>
              <button onClick={() => { if (pendingApply) doApply(pendingApply) }}
                className="w-full py-2 rounded-md bg-warn/15 border border-warn/25 text-xs font-mono font-semibold text-warn/80 hover:bg-warn/25 transition-colors">
                Switch anyway (discard changes)
              </button>
              <button onClick={() => { setPendingApply(null); setChangedFiles([]) }}
                className="w-full py-2 rounded-md border border-surface/15 text-xs font-mono text-muted/50 hover:text-muted/80 hover:bg-surface/10 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {saving && (
        <SaveDialog folder={folder} managedFiles={managedFiles} existing={profiles}
          onClose={() => setSaving(false)}
          onSaved={(msg, id) => { setSaving(false); if (id) setActiveId(id); flash(msg); refresh(folder) }} />
      )}

      {editProfile && (
        <EditDialog profile={editProfile}
          onClose={() => setEditProfile(null)}
          onSaved={(msg) => { setEditProfile(null); flash(msg); refresh(folder) }} />
      )}

      {showManagedSettings && (
        <ManagedFilesModal allFiles={files} managedFiles={managedFiles}
          onClose={() => setShowManagedSettings(false)}
          onSave={(f) => { setManagedFiles(f); setShowManagedSettings(false) }} />
      )}
    </div>
  )
})

// ─── Save (new profile) — name only ──────────────────────────────────────────

function SaveDialog({ folder, managedFiles, existing, onClose, onSaved }: {
  folder: string
  managedFiles: string[]
  existing: IniProfile[]
  onClose: () => void
  onSaved: (msg: string, id?: string) => void
}) {
  const [name, setName] = useState('')

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  const save = async () => {
    if (!name.trim()) return
    const p = await window.api.iniCreate({ name: name.trim(), folder, managedFiles })
    onSaved(`Saved "${name.trim()}"`, p.id)
  }

  const nameExists = existing.some((p) => p.name.toLowerCase() === name.trim().toLowerCase())

  return (
    <Modal title="New Config Profile" onClose={onClose} footer={
      <>
        <button onClick={onClose} className="px-4 py-1.5 rounded-md border border-surface/15 text-xs font-mono text-muted/50 hover:text-muted/80 hover:bg-surface/10 transition-colors">Cancel</button>
        <button onClick={save} disabled={!name.trim()}
          className="px-4 py-1.5 rounded-md bg-accent/20 border border-accent/30 text-xs font-mono font-semibold text-accent hover:bg-accent/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">Save</button>
      </>
    }>
      <div>
        <p className="text-xs font-mono text-muted/40 mb-1">Profile name</p>
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') save() }}
          placeholder="e.g. Triple 1440p, Triple 1080p, Screenshot"
          className="w-full bg-surface/10 border border-surface/15 rounded-md px-3 h-9 text-xs font-mono text-muted/70 focus:outline-none focus:border-accent/40" />
        {nameExists && <p className="text-xs font-mono text-amber/60 mt-1">A profile with this name already exists</p>}
      </div>
      <div className="bg-surface/10 rounded-md px-3 py-2.5 space-y-1">
        <p className="text-xs font-mono text-muted/40 mb-1">Captures a copy of:</p>
        {managedFiles.map((f) => (
          <p key={f} className="text-xs font-mono text-muted/60 flex items-center gap-2">
            <FileText size={10} className="text-accent/50" /> {f}
          </p>
        ))}
      </div>
    </Modal>
  )
}

// ─── Edit dialog (rename + show source files) ─────────────────────────────────

function EditDialog({ profile, onClose, onSaved }: {
  profile: IniProfile
  onClose: () => void
  onSaved: (msg: string) => void
}) {
  const [name, setName] = useState(profile.name)

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  const save = async () => {
    if (!name.trim()) return
    await window.api.iniRename(profile.id, name.trim())
    onSaved(`Renamed to "${name.trim()}"`)
  }

  return (
    <Modal title="Edit Profile" onClose={onClose} footer={
      <>
        <button onClick={async () => { await window.api.iniDelete(profile.id); onSaved('Deleted profile') }}
          className="mr-auto flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono text-warn/60 hover:text-warn hover:bg-warn/10 transition-colors">
          <Trash2 size={12} /> Delete
        </button>
        <button onClick={onClose} className="px-4 py-1.5 rounded-md border border-surface/15 text-xs font-mono text-muted/50 hover:text-muted/80 hover:bg-surface/10 transition-colors">Cancel</button>
        <button onClick={save} disabled={!name.trim()}
          className="px-4 py-1.5 rounded-md bg-accent/20 border border-accent/30 text-xs font-mono font-semibold text-accent hover:bg-accent/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">Save</button>
      </>
    }>
      <div>
        <p className="text-xs font-mono text-muted/40 mb-1">Profile name</p>
        <input value={name} onChange={(e) => setName(e.target.value)}
          className="w-full bg-surface/10 border border-surface/15 rounded-md px-3 h-9 text-xs font-mono text-muted/70 focus:outline-none focus:border-accent/40" />
        <p className="text-xs font-mono text-muted/25 mt-1">Renaming keeps the existing source files.</p>
      </div>
      <div className="bg-surface/10 rounded-md px-3 py-2.5 space-y-1.5">
        <p className="text-xs font-mono text-muted/40">Swaps these files:</p>
        {profile.files.map((target) => (
          <p key={target} className="text-xs font-mono text-muted/60 flex items-center gap-1.5">
            <span className="text-accent/60">{sourceName(target, profile.slug)}</span>
            <span className="text-muted/25">→</span>
            <span>{target}</span>
          </p>
        ))}
      </div>
    </Modal>
  )
}

// ─── Managed files settings ───────────────────────────────────────────────────

function ManagedFilesModal({ allFiles, managedFiles, onClose, onSave }: {
  allFiles: string[]
  managedFiles: string[]
  onClose: () => void
  onSave: (files: string[]) => void
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(managedFiles))
  const [custom, setCustom]     = useState('')

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  const toggle = (f: string) => setSelected((prev) => {
    const next = new Set(prev); next.has(f) ? next.delete(f) : next.add(f); return next
  })
  const addCustom = () => {
    const f = custom.trim()
    if (!f || selected.has(f)) return
    setSelected((prev) => new Set([...prev, f]))
    setCustom('')
  }

  const allOptions = [...new Set([...allFiles, ...managedFiles])].sort((a, b) => a.localeCompare(b))

  return (
    <Modal title="Managed Files" onClose={onClose} footer={
      <>
        <button onClick={onClose} className="px-4 py-1.5 rounded-md border border-surface/15 text-xs font-mono text-muted/50 hover:text-muted/80 hover:bg-surface/10 transition-colors">Cancel</button>
        <button onClick={() => onSave([...selected])}
          className="px-4 py-1.5 rounded-md bg-accent/20 border border-accent/30 text-xs font-mono font-semibold text-accent hover:bg-accent/30 transition-colors">Save</button>
      </>
    }>
      <p className="text-xs font-mono text-muted/40">Choose which files all profiles will capture and swap.</p>
      <div className="space-y-1 rounded-md border border-surface/10 p-1.5 max-h-52 overflow-y-auto">
        {allOptions.map((f) => (
          <label key={f} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-surface/10 cursor-pointer">
            <span className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border ${selected.has(f) ? 'bg-accent/30 border-accent/40' : 'border-surface/20'}`}>
              {selected.has(f) && <Check size={10} className="text-accent" />}
            </span>
            <span className="text-xs font-mono text-muted/60 truncate">{f}</span>
          </label>
        ))}
      </div>
      <div className="flex gap-2">
        <input value={custom} onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') addCustom() }}
          placeholder="Add file not in list… (e.g. custom.ini)"
          className="flex-1 bg-surface/10 border border-surface/15 rounded-md px-3 h-8 text-xs font-mono text-muted/70 focus:outline-none focus:border-accent/40" />
        <button onClick={addCustom} className="px-3 h-8 rounded-md border border-surface/15 text-xs font-mono text-muted/50 hover:text-muted/80 hover:bg-surface/10 transition-colors">Add</button>
      </div>
    </Modal>
  )
}

// ─── Shared modal shell ───────────────────────────────────────────────────────

function Modal({ title, onClose, footer, children }: {
  title: string
  onClose: () => void
  footer: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="relative w-full max-w-md mx-4 rounded-lg bg-surface/8 backdrop-blur-xl border border-surface/12 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface/10 shrink-0">
          <span className="text-sm font-semibold text-muted/80">{title}</span>
          <button onClick={onClose} className="w-7 h-7 rounded-md flex items-center justify-center text-muted/30 hover:text-muted/70 hover:bg-surface/10 transition-colors">
            <X size={14} />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 p-5 space-y-4">{children}</div>
        <div className="px-5 py-3 border-t border-surface/10 flex items-center justify-end gap-2 shrink-0">{footer}</div>
      </div>
    </div>
  )
}
