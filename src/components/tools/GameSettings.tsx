import { memo, useCallback } from 'react'
import { useToolStore } from '@/store/toolStore'
import Panel from '@/components/ui/Panel'
import Button from '@/components/ui/Button'
import Spinbox from '@/components/ui/Spinbox'
import StatusBadge from '@/components/ui/StatusBadge'
import WindowPicker from '@/components/ui/WindowPicker'
import HotkeyBox from '@/components/ui/HotkeyBox'

export default memo(function GameSettings() {
  const running   = useToolStore((s) => s.running.game)
  const config    = useToolStore((s) => s.config.game)
  const setConfig = useToolStore((s) => s.setConfig)

  const setWindowTitle = useCallback(
    (t: string) => setConfig('game', { windowTitle: t }),
    [setConfig],
  )
  const setHotkey = useCallback(
    (raw: string | null) => setConfig('game', { hotkey: raw }),
    [setConfig],
  )
  const setFgFps = useCallback(
    (v: number) => {
      setConfig('game', { fgFps: v })
      if (running) window.api.setGameFps(v, config.bgFps)
    },
    [setConfig, running, config.bgFps],
  )
  const setBgFps = useCallback(
    (v: number) => {
      setConfig('game', { bgFps: v })
      if (running) window.api.setGameFps(config.fgFps, v)
    },
    [setConfig, running, config.fgFps],
  )

  const toggle = useCallback(() => {
    if (running) {
      window.api.stopTool('game')
    } else {
      window.api.startTool('game', config as unknown as Record<string, unknown>)
    }
  }, [running, config])

  return (
    <Panel title="Spiel-Einstellungen">
      <div className="flex items-center justify-between mb-4">
        <StatusBadge running={running} />
      </div>

      <div className="space-y-4 mb-4">
        <WindowPicker value={config.windowTitle} onChange={setWindowTitle} />

        <div className="pt-1 border-t border-surface/10">
          <p className="text-xs font-mono text-muted/30 mb-3 uppercase tracking-wider">FPS-Limit</p>

          <div className="space-y-3">
            <Spinbox
              label="Vordergrund"
              value={config.fgFps}
              onChange={setFgFps}
              min={0}
              max={360}
              suffix="fps"
            />
            <Spinbox
              label="Hintergrund"
              value={config.bgFps}
              onChange={setBgFps}
              min={0}
              max={360}
              suffix="fps"
            />
          </div>

          <p className="text-xs font-mono text-muted/25 mt-2">
            0 = unbegrenzt
          </p>
        </div>

        <div className="pt-1 border-t border-surface/10">
          <p className="text-xs font-mono text-muted/30 mb-1 uppercase tracking-wider">Anti-Pause</p>
          <p className="text-xs font-mono text-muted/40">
            Verhindert Spiel-Pause bei Tab-Out via WH_CALLWNDPROC + DXGI Present-Hook
          </p>
        </div>
        <HotkeyBox tool="game" value={config.hotkey} onChange={setHotkey} disabled={running} />
      </div>

      <Button
        variant={running ? 'danger' : 'primary'}
        onClick={toggle}
        disabled={!config.windowTitle}
      >
        {running ? 'Stoppen' : 'Starten'}
      </Button>

      {!config.windowTitle && (
        <p className="text-xs font-mono text-muted/30 mt-2 text-center">
          Spiel-Fenster auswählen um zu starten
        </p>
      )}
    </Panel>
  )
})
