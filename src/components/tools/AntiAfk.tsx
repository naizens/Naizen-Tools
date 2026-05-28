import { memo, useCallback } from 'react'
import { useToolStore } from '@/store/toolStore'
import Panel from '@/components/ui/Panel'
import Button from '@/components/ui/Button'
import Spinbox from '@/components/ui/Spinbox'
import StatusBadge from '@/components/ui/StatusBadge'
import WindowPicker from '@/components/ui/WindowPicker'
import HotkeyBox from '@/components/ui/HotkeyBox'

export default memo(function AntiAfk() {
  const running = useToolStore((s) => s.running.afk)
  const config = useToolStore((s) => s.config.afk)
  const setConfig = useToolStore((s) => s.setConfig)
  const afkPresses = useToolStore((s) => s.afkPresses)
  const afkRemaining = useToolStore((s) => s.afkRemaining)

  const setSHold = useCallback((v: number) => setConfig('afk', { sHold: v }), [setConfig])
  const setIntervalMs = useCallback((v: number) => setConfig('afk', { intervalMs: v }), [setConfig])
  const setWindowTitle = useCallback((t: string) => setConfig('afk', { windowTitle: t }), [setConfig])
  const setHotkey = useCallback((raw: string | null) => setConfig('afk', { hotkey: raw }), [setConfig])

  const toggle = useCallback(() => {
    if (running) {
      window.api.stopTool('afk')
    } else {
      window.api.startTool('afk', config as unknown as Record<string, unknown>)
    }
  }, [running, config])

  return (
    <Panel title="Anti-AFK">
      <div className="flex items-center justify-between mb-4">
        <StatusBadge running={running} />
        {running && (
          <span className="text-xs font-mono text-muted/40">
            {afkPresses} Drücke · {afkRemaining}s
          </span>
        )}
      </div>

      <div className="space-y-4 mb-4">
        <Spinbox
          label="S-Hold"
          value={config.sHold}
          onChange={setSHold}
          min={50}
          max={5000}
          suffix="ms"
        />
        <Spinbox
          label="Pause"
          value={config.intervalMs}
          onChange={setIntervalMs}
          min={1000}
          max={3600000}
          suffix="ms"
        />
        <WindowPicker value={config.windowTitle} onChange={setWindowTitle} />
        <HotkeyBox tool="afk" value={config.hotkey} onChange={setHotkey} disabled={running} />
      </div>

      <Button variant={running ? 'danger' : 'primary'} onClick={toggle}>
        {running ? 'Stoppen' : 'Starten'}
      </Button>
    </Panel>
  )
})
