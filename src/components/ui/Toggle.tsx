interface Props {
  value: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}

export default function Toggle({ value, onChange, disabled }: Props) {
  return (
    <button
      onClick={() => onChange(!value)}
      disabled={disabled}
      className={[
        'relative w-11 h-6 rounded-full transition-colors shrink-0',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        value ? 'bg-accent/30' : 'bg-muted/20',
      ].join(' ')}
    >
      <span className={[
        'absolute top-1 w-4 h-4 rounded-full transition-all',
        value ? 'left-6 bg-accent' : 'left-1 bg-muted/50',
      ].join(' ')} />
    </button>
  )
}
