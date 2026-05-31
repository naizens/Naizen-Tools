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
  const setEnterEnabled = useCallback(() => setConfig('afk', { enterEnabled: !config.enterEnabled }), [setConfig, config.enterEnabled])
  const setEnterIntervalMs = useCallback((v: number) => setConfig('afk', { enterIntervalMs: v * 1000 }), [setConfig])

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
            {afkPresses} presses · {afkRemaining}s
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
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono text-muted/50">Enter Key</span>
          <button
            onClick={setEnterEnabled}
            disabled={running}
            className={`w-9 h-5 rounded-full transition-colors relative flex items-center ${config.enterEnabled ? 'bg-accent' : 'bg-surface/20'} disabled:opacity-40`}
          >
            <span className={`absolute w-4 h-4 rounded-full bg-white transition-transform ${config.enterEnabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
          </button>
        </div>
        {config.enterEnabled && (
          <Spinbox
            label="Enter Interval"
            value={Math.round(config.enterIntervalMs / 1000)}
            onChange={setEnterIntervalMs}
            min={1}
            max={3600}
            suffix="s"
          />
        )}
        <WindowPicker value={config.windowTitle} onChange={setWindowTitle} />
        <HotkeyBox tool="afk" value={config.hotkey} onChange={setHotkey} disabled={running} />
      </div>

      <Button variant={running ? 'danger' : 'primary'} onClick={toggle}>
        {running ? 'Stop' : 'Start'}
      </Button>
    </Panel>
  )
})
