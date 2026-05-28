import { ReactNode } from 'react'

type Variant = 'primary' | 'danger' | 'amber' | 'ghost'

interface Props {
  variant?: Variant
  loading?: boolean
  disabled?: boolean
  onClick?: () => void
  children: ReactNode
}

const variantClasses: Record<Variant, string> = {
  primary: 'bg-accent/20 text-accent border-accent/30 hover:bg-accent/30',
  danger:  'bg-warn/20  text-warn  border-warn/30  hover:bg-warn/30',
  amber:   'bg-amber/20 text-amber  border-amber/30  hover:bg-amber/30',
  ghost:   'bg-surface/10 text-muted/60 border-surface/15 hover:bg-surface/20',
}

export default function Button({ variant = 'primary', loading, disabled, onClick, children }: Props) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={[
        'rounded-md px-5 py-2.5 font-mono font-semibold text-sm border transition-colors',
        variantClasses[variant],
        (disabled || loading) ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer',
      ].join(' ')}
    >
      {loading ? '...' : children}
    </button>
  )
}
