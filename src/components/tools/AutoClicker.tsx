import { memo, useCallback, useState } from 'react'
import { useToolStore } from '@/store/toolStore'
import Panel from '@/components/ui/Panel'
import Button from '@/components/ui/Button'
import Spinbox from '@/components/ui/Spinbox'
import CaptureBox from '@/components/ui/CaptureBox'
import StatusBadge from '@/components/ui/StatusBadge'
import HotkeyBox from '@/components/ui/HotkeyBox'

type MouseButton = 'left' | 'right' | 'middle'

const BUTTONS: MouseButton[] = ['left', 'right', 'middle']
const BUTTON_LABELS: Record<MouseButton, string> = {
  left: 'Links',
  right: 'Rechts',
  middle: 'Mitte',
}

export default memo(function AutoClicker() {
  const running = useToolStore((s) => s.running.clicker)
  const config = useToolStore((s) => s.config.clicker)
  const setConfig = useToolStore((s) => s.setConfig)
  const [capturing, setCapturing] = useState(false)

  const setInterval_ = useCallback((v: number) => setConfig('clicker', { intervalMs: v }), [setConfig])
  const setButton = useCallback((b: MouseButton) => setConfig('clicker', { button: b }), [setConfig])
  const setHotkey = useCallback((raw: string | null) => setConfig('clicker', { hotkey: raw }), [setConfig])

  const startCapture = useCallback(async () => {
    setCapturing(true)
    await window.api.startCapture('mouse')
    window.api.onCaptureResult(({ label, value }) => {
      setConfig('clicker', { button: value as MouseButton })
      void label
      setCapturing(false)
    })
  }, [setConfig])

  const toggle = useCallback(() => {
    if (running) {
      window.api.stopTool('clicker')
    } else {
      window.api.startTool('clicker', config as unknown as Record<string, unknown>)
    }
  }, [running, config])

  return (
    <Panel title="Auto-Klicker">
      <div className="flex items-center justify-between mb-4">
        <StatusBadge running={running} />
      </div>
      <div className="flex gap-2 mb-4">
        {BUTTONS.map((b) => (
          <button
            key={b}
            onClick={() => setButton(b)}
            className={[
              'px-3 py-1.5 rounded-md border font-mono text-xs transition-colors',
              config.button === b
                ? 'bg-accent/20 border-accent/30 text-accent'
                : 'bg-surface/10 border-surface/15 text-muted/50 hover:bg-surface/20',
            ].join(' ')}
          >
            {BUTTON_LABELS[b]}
          </button>
        ))}
      </div>
      <div className="mb-4">
        <CaptureBox
          label={`Taste: ${BUTTON_LABELS[config.button]} — klicken zum Ändern`}
          capturing={capturing}
          onCapture={startCapture}
        />
      </div>
      <div className="mb-4">
        <Spinbox label="Intervall" value={config.intervalMs} onChange={setInterval_} min={10} max={60000} suffix="ms" />
      </div>
      <div className="mb-4">
        <HotkeyBox tool="clicker" value={config.hotkey} onChange={setHotkey} disabled={running} />
      </div>
      <Button variant={running ? 'danger' : 'primary'} onClick={toggle}>
        {running ? 'Stoppen' : 'Starten'}
      </Button>
    </Panel>
  )
})
