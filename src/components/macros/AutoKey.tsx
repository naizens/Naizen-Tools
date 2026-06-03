import { memo, useCallback, useState } from 'react'
import { useToolStore } from '@/store/toolStore'
import Panel from '@/components/ui/Panel'
import Button from '@/components/ui/Button'
import Spinbox from '@/components/ui/Spinbox'
import CaptureBox from '@/components/ui/CaptureBox'
import StatusBadge from '@/components/ui/StatusBadge'
import HotkeyBox from '@/components/ui/HotkeyBox'

export default memo(function AutoKey() {
  const running = useToolStore((s) => s.running.autokey)
  const config = useToolStore((s) => s.config.autokey)
  const setConfig = useToolStore((s) => s.setConfig)
  const [capturing, setCapturing] = useState(false)

  const setDownMs = useCallback((v: number) => setConfig('autokey', { downMs: v }), [setConfig])
  const setUpMs = useCallback((v: number) => setConfig('autokey', { upMs: v }), [setConfig])
  const setHotkey = useCallback((raw: string | null) => setConfig('autokey', { hotkey: raw }), [setConfig])

  const startCapture = useCallback(async () => {
    setCapturing(true)
    await window.api.startCapture('keyboard')
    window.api.onCaptureResult(({ label, value }) => {
      setConfig('autokey', { key: value, keyLabel: label })
      setCapturing(false)
    })
  }, [setConfig])

  const toggle = useCallback(() => {
    if (running) {
      window.api.stopTool('autokey')
    } else {
      window.api.startTool('autokey', config as unknown as Record<string, unknown>)
    }
  }, [running, config])

  return (
    <Panel title="Auto Key">
      <div className="flex items-center justify-between mb-4">
        <StatusBadge running={running} />
      </div>
      <div className="mb-4">
        <CaptureBox
          label={`Key: ${config.keyLabel} — click to change`}
          capturing={capturing}
          onCapture={startCapture}
        />
      </div>
      <div className="flex flex-wrap gap-4 mb-4">
        <Spinbox label="Hold" value={config.downMs} onChange={setDownMs} min={10} max={5000} suffix="ms" />
        <Spinbox label="Pause" value={config.upMs} onChange={setUpMs} min={10} max={5000} suffix="ms" />
      </div>
      <div className="mb-4">
        <HotkeyBox tool="autokey" value={config.hotkey} onChange={setHotkey} disabled={running} />
      </div>
      <Button variant={running ? 'danger' : 'primary'} disabled={!config.key} onClick={toggle}>
        {running ? 'Stop' : 'Start'}
      </Button>
    </Panel>
  )
})
