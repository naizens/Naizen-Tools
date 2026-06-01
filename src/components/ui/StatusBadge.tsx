import { Circle } from 'lucide-react'

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
      <Circle size={7} fill="currentColor" strokeWidth={0} />
      {running ? 'active' : 'stopped'}
    </span>
  )
}
