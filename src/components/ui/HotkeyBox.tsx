import { memo, useCallback, useEffect, useState } from 'react'

export function toHotkeyDisplay(raw: string): string {
  if (raw.startsWith('Key') && raw.length === 4) return raw.slice(3)
  if (raw.startsWith('Digit')) return raw.slice(5)
  if (raw.startsWith('Numpad')) return `Num${raw.slice(6)}`
  const map: Record<string, string> = {
    ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
    Escape: 'Esc', Space: 'Space', Enter: 'Enter', Backspace: '⌫',
    Delete: 'Del', Home: 'Home', End: 'End', PageUp: 'PgUp', PageDown: 'PgDn',
  }
  return map[raw] ?? raw
}

interface Props {
  tool: string
  value: string | null
  onChange: (raw: string | null) => void
  disabled?: boolean
}

export default memo(function HotkeyBox({ tool, value, onChange, disabled }: Props) {
  const [capturing, setCapturing] = useState(false)

  useEffect(() => {
    if (!capturing) return
    window.api.onCaptureResult(({ value: raw }) => {
      onChange(raw)
      window.api.setHotkey(tool, raw)
      setCapturing(false)
    })
    window.api.startCapture('keyboard')
  }, [capturing, tool, onChange])

  const clear = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onChange(null)
    window.api.clearHotkey(tool)
  }, [tool, onChange])

  return (
    <div className="flex items-center justify-between">
      <span className="text-xs font-mono text-muted/30 uppercase tracking-wider">Hotkey</span>
      <div className="flex items-center gap-1.5">
        {value && !disabled && (
          <button
            onClick={clear}
            className="text-xs font-mono text-muted/25 hover:text-warn/60 transition-colors leading-none"
          >
            ✕
          </button>
        )}
        <button
          onClick={() => !disabled && setCapturing(true)}
          disabled={disabled}
          className={[
            'px-3 py-1 rounded-md border font-mono text-xs transition-colors min-w-[56px] text-center',
            disabled
              ? 'opacity-30 cursor-not-allowed bg-surface/5 border-surface/10 text-muted/40'
              : capturing
                ? 'border-accent/50 text-accent/80 bg-accent/5'
                : value
                  ? 'bg-surface/10 border-surface/20 text-muted/60 hover:bg-surface/15'
                  : 'bg-surface/5 border-dashed border-surface/15 text-muted/25 hover:border-surface/25 hover:text-muted/40',
          ].join(' ')}
        >
          {capturing ? '…' : value ? toHotkeyDisplay(value) : '—'}
        </button>
      </div>
    </div>
  )
})
