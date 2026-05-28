interface Props {
  label: string
  capturing: boolean
  onCapture: () => void
}

export default function CaptureBox({ label, capturing, onCapture }: Props) {
  return (
    <button
      onClick={onCapture}
      disabled={capturing}
      className={[
        'w-full bg-surface/10 border-2 border-dashed rounded-md px-4 py-3 font-mono text-sm text-left transition-colors cursor-pointer',
        capturing
          ? 'border-accent/50 text-accent'
          : 'border-surface/20 text-muted/50 hover:border-surface/40',
      ].join(' ')}
    >
      {capturing ? '● Taste drücken…' : label}
    </button>
  )
}
