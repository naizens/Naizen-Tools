import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AppWindow, ChevronDown, ChevronUp, X } from 'lucide-react'

interface Props {
  value: string
  onChange: (title: string) => void
}

interface DropdownPos {
  top: number
  left: number
  width: number
}

export default function WindowPicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [windows, setWindows] = useState<WindowInfo[]>([])
  const [query, setQuery] = useState('')
  const [pos, setPos] = useState<DropdownPos | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const openPicker = useCallback(async () => {
    if (wrapperRef.current) {
      const r = wrapperRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 4, left: r.left, width: r.width })
    }
    setQuery('')
    setOpen(true)
    if (windows.length === 0) {
      setLoading(true)
      try {
        const list = await window.api.windowsList()
        setWindows(list.filter((w) => w.title.trim().length > 0))
      } finally {
        setLoading(false)
      }
    }
  }, [windows.length])

  const close = useCallback(() => {
    setOpen(false)
    setQuery('')
    inputRef.current?.blur()
  }, [])

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      const inWrapper = wrapperRef.current?.contains(target)
      const inPortal = (target as Element).closest?.('[data-window-picker-portal]')
      if (!inWrapper && !inPortal) close()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open, close])

  const filtered = query.trim()
    ? windows.filter((w) => w.title.toLowerCase().includes(query.toLowerCase()))
    : windows

  const selected = windows.find((w) => w.title === value)

  const dropdown = open && pos ? createPortal(
    <div
      data-window-picker-portal
      style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, zIndex: 9999 }}
      className="rounded-md bg-app border border-surface/15 shadow-2xl overflow-hidden"
    >
      {loading ? (
        <div className="px-4 py-3 text-xs font-mono text-muted/40">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="px-4 py-3 text-xs font-mono text-muted/40">
          {query ? 'No match' : 'No windows found'}
        </div>
      ) : (
        <div className="max-h-52 overflow-y-auto">
          {filtered.map((w) => (
            <button
              key={w.handle}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onChange(w.title); close() }}
              className={[
                'w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors',
                w.title === value ? 'bg-accent/15 text-accent' : 'text-muted/60 hover:bg-surface/10',
              ].join(' ')}
            >
              {w.icon ? (
                <img src={`data:image/png;base64,${w.icon}`} className="w-4 h-4 shrink-0 object-contain" alt="" />
              ) : (
                <span className="w-4 h-4 shrink-0 rounded bg-surface/20 flex items-center justify-center text-muted/30">
                  <AppWindow size={10} />
                </span>
              )}
              <span className="text-xs font-mono truncate">{w.title}</span>
            </button>
          ))}
        </div>
      )}
    </div>,
    document.body,
  ) : null

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-mono text-muted/40">Game Window</span>
      <div className="flex gap-2" ref={wrapperRef}>
        <div className="flex-1 flex items-center gap-2.5 bg-surface/10 border border-surface/15 rounded-md px-3 h-9 min-w-0 focus-within:border-accent/40 transition-colors">
          {!open && selected?.icon && (
            <img src={`data:image/png;base64,${selected.icon}`} className="w-4 h-4 shrink-0 object-contain" alt="" />
          )}
          <input
            ref={inputRef}
            value={open ? query : value}
            placeholder={open ? 'Filter…' : 'Select window…'}
            onFocus={openPicker}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 min-w-0 bg-transparent text-xs font-mono text-muted/70 placeholder:text-muted/30 focus:outline-none"
          />
          <span className="text-muted/25 shrink-0">
            {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </span>
        </div>

        {value && (
          <button
            onClick={() => { onChange(''); close() }}
            className="w-9 h-9 shrink-0 rounded-md bg-surface/10 border border-surface/15 text-muted/40 hover:text-warn hover:bg-warn/10 transition-colors flex items-center justify-center"
          >
            <X size={14} />
          </button>
        )}
      </div>
      {dropdown}
    </div>
  )
}
