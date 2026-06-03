interface Props {
  label?: string
}

export default function Divider({ label }: Props) {
  if (!label) return <div className="border-t border-surface/10" />
  return (
    <div className="border-t border-surface/10 pt-3">
      <p className="text-xs font-mono text-muted/30 uppercase tracking-wider">{label}</p>
    </div>
  )
}
