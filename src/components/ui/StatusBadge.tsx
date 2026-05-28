interface Props {
  running: boolean
}

export default function StatusBadge({ running }: Props) {
  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 text-xs font-mono',
        running ? 'text-success' : 'text-muted/40',
      ].join(' ')}
    >
      ● {running ? 'aktiv' : 'gestoppt'}
    </span>
  )
}
