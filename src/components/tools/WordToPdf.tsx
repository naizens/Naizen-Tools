import { memo, useEffect, useRef, useState } from 'react'
import { FileText, FolderOpen, Trash2, CheckCircle, XCircle, Loader, ExternalLink, Plus } from 'lucide-react'
import { useToolStore, type WordPdfFile } from '@/store/toolStore'

type FileEntry = WordPdfFile

function statusIcon(status: FileEntry['status']) {
  if (status === 'converting') return <Loader size={14} className="text-accent animate-spin shrink-0" />
  if (status === 'done')       return <CheckCircle size={14} className="text-success shrink-0" />
  if (status === 'error')      return <XCircle size={14} className="text-warn shrink-0" />
  return <FileText size={14} className="text-muted/30 shrink-0" />
}

export default memo(function WordToPdf() {
  const files        = useToolStore((s) => s.wordPdfFiles)
  const setFiles     = useToolStore((s) => s.setWordPdfFiles)
  const outFolder    = useToolStore((s) => s.wordPdfOutFolder)
  const setOutFolder = useToolStore((s) => s.setWordPdfOutFolder)
  const [converting, setConverting] = useState(false)
  const dropRef = useRef<HTMLDivElement>(null)
  const [dragOver, setDragOver]   = useState(false)

  // Reset any stuck 'converting' entries left over from navigating away mid-conversion
  useEffect(() => {
    setFiles((prev) => prev.map((f) => f.status === 'converting' ? { ...f, status: 'pending' } : f))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // Document-level handlers are required in Electron to enable drop events at all.
    // Without these, the OS drag is never recognised as valid and element events never fire.
    const docOver = (e: DragEvent) => { e.preventDefault(); e.stopPropagation() }
    const docDrop = (e: DragEvent) => { e.preventDefault(); e.stopPropagation() }
    document.addEventListener('dragover', docOver)
    document.addEventListener('drop',     docDrop)

    const el = dropRef.current
    if (!el) return

    const onOver  = (e: DragEvent) => { e.preventDefault(); e.stopPropagation(); setDragOver(true) }
    const onLeave = (e: DragEvent) => { e.preventDefault(); e.stopPropagation(); setDragOver(false) }
    const onDrop  = (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setDragOver(false)
      const paths = Array.from(e.dataTransfer?.files ?? [])
        .map((f) => window.api.getPathForFile(f))
        .filter((p): p is string => !!p && p.toLowerCase().endsWith('.docx'))
      addPaths(paths)
    }

    el.addEventListener('dragover',  onOver)
    el.addEventListener('dragleave', onLeave)
    el.addEventListener('drop',      onDrop)

    return () => {
      document.removeEventListener('dragover', docOver)
      document.removeEventListener('drop',     docDrop)
      el.removeEventListener('dragover',  onOver)
      el.removeEventListener('dragleave', onLeave)
      el.removeEventListener('drop',      onDrop)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function addPaths(paths: string[]) {
    const docx = paths.filter((p): p is string => !!p && p.toLowerCase().endsWith('.docx'))
    if (!docx.length) return
    setFiles((prev) => {
      const existing = new Set(prev.map((f) => f.inputPath))
      const next = docx
        .filter((p) => !existing.has(p))
        .map((p) => ({
          id: Math.random().toString(36).slice(2),
          inputPath: p,
          name: p.split(/[\\/]/).pop() ?? p,
          status: 'pending' as const,
        }))
      return [...prev, ...next]
    })
  }

  const pickFiles = async () => {
    const paths = await window.api.wordPdfPickFiles()
    if (paths) addPaths(paths)
  }

  const pickFolder = async () => {
    const folder = await window.api.wordPdfPickFolder()
    if (folder) setOutFolder(folder)
  }

  const removeFile = (id: string) =>
    setFiles((prev) => prev.filter((f) => f.id !== id))

  const convertAll = async () => {
    const pending = files.filter((f) => f.status === 'pending' || f.status === 'error')
    if (!pending.length) return
    setConverting(true)

    for (const entry of pending) {
      setFiles((prev) => prev.map((f) => f.id === entry.id ? { ...f, status: 'converting' } : f))
      try {
        const outputPath = await window.api.wordPdfConvert(entry.inputPath, outFolder || null)
        setFiles((prev) => prev.map((f) =>
          f.id === entry.id ? { ...f, status: 'done', outputPath } : f
        ))
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Conversion failed'
        setFiles((prev) => prev.map((f) =>
          f.id === entry.id ? { ...f, status: 'error', error: msg } : f
        ))
      }
    }
    setConverting(false)
  }

  const pendingCount = files.filter((f) => f.status === 'pending' || f.status === 'error').length

  return (
    <div className="flex flex-col h-full -mx-4 -my-4">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-surface/10 shrink-0">
        <span className="text-xs font-mono font-semibold text-muted/40 tracking-widest uppercase">Word → PDF</span>
        {files.length > 0 && (
          <button onClick={() => setFiles([])} className="text-xs font-mono text-muted/25 hover:text-muted/50 transition-colors">
            Clear all
          </button>
        )}
      </div>

      {/* Drop zone */}
      <div
        ref={dropRef}
        onClick={pickFiles}
        className={[
          'mx-5 mt-4 shrink-0 flex items-center justify-center gap-3 rounded-lg border-2 border-dashed cursor-pointer transition-colors h-16',
          dragOver
            ? 'border-accent/60 bg-accent/5'
            : 'border-surface/20 hover:border-surface/40 hover:bg-surface/5',
        ].join(' ')}
      >
        <Plus size={15} className={dragOver ? 'text-accent' : 'text-muted/30'} />
        <p className="text-xs font-mono text-muted/40">
          Drop .docx files or <span className="text-accent">click to browse</span>
        </p>
      </div>

      {/* Output folder */}
      <div className="flex items-center gap-2 px-5 py-2.5 shrink-0">
        <button
          onClick={pickFolder}
          className="flex items-center gap-1.5 px-3 h-8 rounded-md border border-surface/15 text-xs font-mono text-muted/50 hover:text-muted/80 hover:bg-surface/10 transition-colors shrink-0"
        >
          <FolderOpen size={13} />
          Output folder
        </button>
        <span className="text-xs font-mono text-muted/40 truncate flex-1 min-w-0" title={outFolder}>
          {outFolder || 'Same folder as source file'}
        </span>
        {outFolder && (
          <button onClick={() => setOutFolder('')} className="text-muted/25 hover:text-muted/50 transition-colors shrink-0">
            <Trash2 size={12} />
          </button>
        )}
      </div>

      {/* File list */}
      <div className="flex-1 overflow-y-auto px-5 space-y-1.5 pb-2">
        {files.map((f) => (
          <div
            key={f.id}
            className={[
              'flex items-center gap-3 px-3 py-2.5 rounded-md border transition-colors',
              f.status === 'done'       ? 'bg-success/5 border-success/20' :
              f.status === 'error'      ? 'bg-warn/5 border-warn/20' :
              f.status === 'converting' ? 'bg-accent/5 border-accent/20' :
              'bg-surface/5 border-surface/10',
            ].join(' ')}
          >
            {statusIcon(f.status)}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-mono text-muted/70 truncate">{f.name}</p>
              {f.status === 'error' && (
                <p className="text-xs font-mono text-warn/60 truncate mt-0.5">{f.error}</p>
              )}
            </div>
            {f.status === 'done' && f.outputPath && (
              <button
                onClick={() => window.api.wordPdfOpen(f.outputPath!)}
                className="flex items-center gap-1 px-2 py-1 rounded text-xs font-mono text-success/70 hover:text-success hover:bg-success/10 transition-colors shrink-0"
              >
                <ExternalLink size={11} /> Open
              </button>
            )}
            {f.status !== 'converting' && (
              <button onClick={() => removeFile(f.id)} className="text-muted/20 hover:text-muted/50 transition-colors shrink-0">
                <Trash2 size={12} />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Footer — always visible */}
      <div className="px-5 py-3 border-t border-surface/10 shrink-0">
        <button
          onClick={convertAll}
          disabled={converting || pendingCount === 0}
          className="w-full h-9 rounded-md bg-accent/20 border border-accent/30 text-xs font-mono font-semibold text-accent hover:bg-accent/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {converting
            ? 'Converting…'
            : pendingCount > 0
              ? `Convert${pendingCount > 1 ? ` ${pendingCount} files` : ''}`
              : 'Drop files to convert'}
        </button>
      </div>
    </div>
  )
})
