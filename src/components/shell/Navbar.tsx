import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { useToolStore } from '@/store/toolStore'

export type Tool = 'afk' | 'clicker' | 'autokey' | 'screenshot' | 'iracing-apps' | 'iracing-ini' | 'iracing-monitor' | 'word-pdf'

const MACROS_TOOLS: Tool[] = ['clicker', 'autokey']
const IRACING_TOOLS: Tool[] = ['screenshot', 'iracing-apps', 'iracing-ini', 'iracing-monitor']
const TOOLS_TOOLS: Tool[] = ['word-pdf']

const MACROS_ITEMS: { id: Tool; label: string }[] = [
  { id: 'clicker', label: 'Clicker' },
  { id: 'autokey', label: 'Auto Key' },
]

const IRACING_ITEMS: { id: Tool; label: string }[] = [
  { id: 'screenshot',       label: 'Screenshot' },
  { id: 'iracing-apps',     label: 'Apps' },
  { id: 'iracing-ini',      label: 'Config Profiles' },
  { id: 'iracing-monitor',  label: 'Monitor' },
]

const TOOLS_ITEMS: { id: Tool; label: string }[] = [
  { id: 'word-pdf', label: 'Word → PDF' },
]

const FLAT_TABS: { id: Tool; label: string }[] = [
  { id: 'afk', label: 'Anti-AFK' },
]

interface Props {
  active: Tool
  onChange: (t: Tool) => void
}

interface DropdownProps {
  label: string
  items: { id: Tool; label: string }[]
  tools: Tool[]
  active: Tool
  running: boolean
  width: string
  onChange: (t: Tool) => void
}

function Dropdown({ label, items, tools, active, running, width, onChange }: DropdownProps) {
  const [open, setOpen] = useState(false)
  const isActive = tools.includes(active)

  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        onClick={() => onChange(items[0].id)}
        className={[
          'relative flex items-center gap-1 px-4 py-2.5 text-xs font-mono font-semibold transition-colors',
          isActive ? 'text-accent' : 'text-muted/40 hover:text-muted/70',
        ].join(' ')}
      >
        {label}
        <ChevronDown size={10} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        {running && (
          <span className="absolute top-2 right-1.5 w-1.5 h-1.5 rounded-full bg-success" />
        )}
        {isActive && (
          <span className="absolute bottom-0 left-2 right-2 h-px bg-accent rounded-full" />
        )}
      </button>

      {open && (
        <div className={`absolute top-full left-0 ${width} rounded-md bg-app border border-surface/15 shadow-xl overflow-hidden z-50`}>
          {items.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => { onChange(id); setOpen(false) }}
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
  )
}

export default function Navbar({ active, onChange }: Props) {
  const running = useToolStore((s) => s.running)

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

      <Dropdown
        label="Macros"
        items={MACROS_ITEMS}
        tools={MACROS_TOOLS}
        active={active}
        running={running.clicker || running.autokey}
        width="w-32"
        onChange={onChange}
      />

      <Dropdown
        label="iRacing"
        items={IRACING_ITEMS}
        tools={IRACING_TOOLS}
        active={active}
        running={false}
        width="w-36"
        onChange={onChange}
      />

      <Dropdown
        label="Tools"
        items={TOOLS_ITEMS}
        tools={TOOLS_TOOLS}
        active={active}
        running={false}
        width="w-28"
        onChange={onChange}
      />
    </nav>
  )
}
