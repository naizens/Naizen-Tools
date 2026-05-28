import { useCallback } from 'react'

interface Props {
  label: string
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  suffix?: string
  className?: string
}

export default function Spinbox({ label, value, onChange, min = 0, max = 99999, suffix, className }: Props) {
  const clamp = useCallback(
    (v: number) => Math.min(max, Math.max(min, v)),
    [min, max],
  )

  return (
    <label className={['flex flex-col gap-1', className].filter(Boolean).join(' ')}>
      <span className="text-xs font-mono text-muted/40">{label}</span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(clamp(value - 10))}
          className="w-7 h-8 rounded-md bg-surface/10 border border-surface/15 text-muted/60 hover:bg-surface/20 transition-colors font-mono text-xs"
        >
          −−
        </button>
        <button
          onClick={() => onChange(clamp(value - 1))}
          className="w-7 h-8 rounded-md bg-surface/10 border border-surface/15 text-muted/60 hover:bg-surface/20 transition-colors font-mono text-xs"
        >
          −
        </button>
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          onChange={(e) => onChange(clamp(parseInt(e.target.value) || 0))}
          className="w-32 min-w-[120px] h-8 bg-surface/10 border border-surface/15 rounded-md px-3 font-mono text-sm text-center text-muted/80 focus:outline-none focus:border-accent/40"
        />
        <button
          onClick={() => onChange(clamp(value + 1))}
          className="w-7 h-8 rounded-md bg-surface/10 border border-surface/15 text-muted/60 hover:bg-surface/20 transition-colors font-mono text-xs"
        >
          +
        </button>
        <button
          onClick={() => onChange(clamp(value + 10))}
          className="w-7 h-8 rounded-md bg-surface/10 border border-surface/15 text-muted/60 hover:bg-surface/20 transition-colors font-mono text-xs"
        >
          ++
        </button>
        {suffix && <span className="text-xs font-mono text-muted/40 ml-1">{suffix}</span>}
      </div>
    </label>
  )
}
