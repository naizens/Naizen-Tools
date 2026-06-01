import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { useToolStore } from '@/store/toolStore'

export type Tool = 'afk' | 'clicker' | 'autokey' | 'game' | 'screenshot'

const MACROS_TOOLS: Tool[] = ['clicker', 'autokey']
const IRACING_TOOLS: Tool[] = ['game', 'screenshot']

const MACROS_ITEMS: { id: Tool; label: string }[] = [
  { id: 'clicker', label: 'Clicker' },
  { id: 'autokey', label: 'Auto Key' },
]

const IRACING_ITEMS: { id: Tool; label: string }[] = [
  { id: 'game',       label: 'Game Settings' },
  { id: 'screenshot', label: 'Screenshot' },
]

const FLAT_TABS: { id: Tool; label: string }[] = [
  { id: 'afk', label: 'Anti-AFK' },
]

interface Props {
  active: Tool
  onChange: (t: Tool) => void
}

export default function Navbar({ active, onChange }: Props) {
  const running = useToolStore((s) => s.running)
  const [openMacros, setOpenMacros] = useState(false)
  const [openIracing, setOpenIracing] = useState(false)
  const macrosRef = useRef<HTMLDivElement>(null)
  const iracingRef = useRef<HTMLDivElement>(null)

  const macrosActive  = MACROS_TOOLS.includes(active)
  const iracingActive = IRACING_TOOLS.includes(active)

  useEffect(() => {
    if (!openMacros && !openIracing) return
    const handler = (e: MouseEvent) => {
      if (!macrosRef.current?.contains(e.target as Node)) setOpenMacros(false)
      if (!iracingRef.current?.contains(e.target as Node)) setOpenIracing(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [openMacros, openIracing])

  return (
    <nav className="flex border-b border-surface/10 px-2 shrink-0">
      {FLAT_TABS.map(({ id, label }) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          className={[
            'relative px-4 py-2.5 text-xs font-mono font-semibold transition-colors',
            active === id ? 'text-accent' : 'text-muted/40 hover:text-muted/70',
          ].join(' ')}
        >
          {label}
          {running[id as keyof typeof running] && (
            <span className="absolute top-2 right-1.5 w-1.5 h-1.5 rounded-full bg-success" />
          )}
          {active === id && (
            <span className="absolute bottom-0 left-2 right-2 h-px bg-accent rounded-full" />
          )}
        </button>
      ))}

      {/* Macros dropdown */}
      <div ref={macrosRef} className="relative">
        <button
          onClick={() => setOpenMacros((v) => !v)}
          className={[
            'relative flex items-center gap-1 px-4 py-2.5 text-xs font-mono font-semibold transition-colors',
            macrosActive ? 'text-accent' : 'text-muted/40 hover:text-muted/70',
          ].join(' ')}
        >
          Macros
          <ChevronDown size={10} className={`transition-transform ${openMacros ? 'rotate-180' : ''}`} />
          {(running.clicker || running.autokey) && (
            <span className="absolute top-2 right-1.5 w-1.5 h-1.5 rounded-full bg-success" />
          )}
          {macrosActive && (
            <span className="absolute bottom-0 left-2 right-2 h-px bg-accent rounded-full" />
          )}
        </button>

        {openMacros && (
          <div className="absolute top-full left-0 mt-1 w-32 rounded-md bg-app border border-surface/15 shadow-xl overflow-hidden z-50">
            {MACROS_ITEMS.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => { onChange(id); setOpenMacros(false) }}
                className={[
                  'w-full text-left px-3 py-2 text-xs font-mono transition-colors',
                  active === id
                    ? 'text-accent bg-accent/10'
                    : 'text-muted/50 hover:text-muted/80 hover:bg-surface/10',
                ].join(' ')}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* iRacing dropdown */}
      <div ref={iracingRef} className="relative">
        <button
          onClick={() => setOpenIracing((v) => !v)}
          className={[
            'relative flex items-center gap-1 px-4 py-2.5 text-xs font-mono font-semibold transition-colors',
            iracingActive ? 'text-accent' : 'text-muted/40 hover:text-muted/70',
          ].join(' ')}
        >
          iRacing
          <ChevronDown size={10} className={`transition-transform ${openIracing ? 'rotate-180' : ''}`} />
          {running.game && (
            <span className="absolute top-2 right-1.5 w-1.5 h-1.5 rounded-full bg-success" />
          )}
          {iracingActive && (
            <span className="absolute bottom-0 left-2 right-2 h-px bg-accent rounded-full" />
          )}
        </button>

        {openIracing && (
          <div className="absolute top-full left-0 mt-1 w-36 rounded-md bg-app border border-surface/15 shadow-xl overflow-hidden z-50">
            {IRACING_ITEMS.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => { onChange(id); setOpenIracing(false) }}
                className={[
                  'w-full text-left px-3 py-2 text-xs font-mono transition-colors',
                  active === id
                    ? 'text-accent bg-accent/10'
                    : 'text-muted/50 hover:text-muted/80 hover:bg-surface/10',
                ].join(' ')}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
    </nav>
  )
}
