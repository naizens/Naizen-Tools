import { useToolStore } from '@/store/toolStore'

export type Tool = 'afk' | 'clicker' | 'autokey' | 'game'

const TABS: { id: Tool; label: string }[] = [
  { id: 'afk',     label: 'Anti-AFK' },
  { id: 'clicker', label: 'Clicker' },
  { id: 'autokey', label: 'Auto Key' },
  { id: 'game',    label: 'Game' },
]

interface Props {
  active: Tool
  onChange: (t: Tool) => void
}

export default function Navbar({ active, onChange }: Props) {
  const running = useToolStore((s) => s.running)

  return (
    <nav className="flex border-b border-surface/10 px-2 shrink-0">
      {TABS.map(({ id, label }) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          className={[
            'relative px-4 py-2.5 text-xs font-mono font-semibold transition-colors',
            active === id
              ? 'text-accent'
              : 'text-muted/40 hover:text-muted/70',
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
    </nav>
  )
}
