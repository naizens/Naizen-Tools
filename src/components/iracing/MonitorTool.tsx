import { memo, useEffect, useMemo, useState } from 'react'
import Select from '@/components/ui/Select'

interface MonitorMode {
  width: number
  height: number
  hz: number
}

interface MonitorInfo {
  name: string
  label: string
  x: number
  y: number
  width: number
  height: number
  hz: number
  modes: MonitorMode[]
}

type ApplyResult = 'success' | 'error' | null

// ─── Monitor Map ──────────────────────────────────────────────────────────────

function MonitorMap({ monitors, selected, onSelect }: {
  monitors: MonitorInfo[]
  selected: string
  onSelect: (name: string) => void
}) {
  const minX = Math.min(...monitors.map(m => m.x))
  const minY = Math.min(...monitors.map(m => m.y))
  const maxX = Math.max(...monitors.map(m => m.x + (m.width  || 1920)))
  const maxY = Math.max(...monitors.map(m => m.y + (m.height || 1080)))
  const vw = maxX - minX || 1
  const vh = maxY - minY || 1

  return (
    <div className="relative w-full" style={{ paddingBottom: `${(vh / vw) * 100}%`, maxHeight: 160 }}>
      <div className="absolute inset-0 flex items-stretch">
        <div className="relative w-full">
          {monitors.map((m, i) => {
            const left   = `${((m.x - minX) / vw) * 100}%`
            const top    = `${((m.y - minY) / vh) * 100}%`
            const width  = `${((m.width  || 1920) / vw) * 100}%`
            const height = `${((m.height || 1080) / vh) * 100}%`
            const active = m.name === selected
            return (
              <button
                key={i}
                onClick={() => onSelect(m.name)}
                title={m.label || m.name}
                style={{ left, top, width, height, padding: 2 }}
                className="absolute"
              >
                <div className={[
                  'w-full h-full rounded-sm border flex items-center justify-center',
                  'text-xs font-mono font-bold transition-colors',
                  active
                    ? 'bg-accent/30 border-accent text-accent'
                    : 'bg-surface/10 border-surface/20 text-muted/30 hover:bg-surface/20 hover:border-surface/40 hover:text-muted/60',
                ].join(' ')}>
                  {i + 1}
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default memo(function MonitorTool() {
  const [monitors, setMonitors]        = useState<MonitorInfo[]>([])
  const [loading, setLoading]          = useState(true)
  const [selectedMonitor, setSelected] = useState<string>('')
  const [selectedRes, setRes]          = useState<string>('')
  const [selectedHz, setHz]            = useState<string>('')
  const [applyResult, setApplyResult]  = useState<ApplyResult>(null)
  const [applying, setApplying]        = useState(false)

  const loadMonitors = async () => {
    setLoading(true)
    try {
      const data = await window.api.monitorList()
      setMonitors(data)
      if (data.length > 0) {
        setSelected(data[0].name)
        populateSelects(data[0])
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadMonitors() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function populateSelects(monitor: MonitorInfo) {
    const seen = new Map<string, true>()
    for (const m of monitor.modes) seen.set(`${m.width}x${m.height}`, true)
    const list = Array.from(seen.keys()).sort((a, b) => {
      const [aw, ah] = a.split('x').map(Number)
      const [bw, bh] = b.split('x').map(Number)
      return bw !== aw ? bw - aw : bh - ah
    })
    const currentRes = monitor.width ? `${monitor.width}x${monitor.height}` : ''
    const defaultRes = list.includes(currentRes) ? currentRes : (list[0] ?? '')
    setRes(defaultRes)

    const hzs = hzList(monitor.modes, defaultRes)
    const currentHz = String(monitor.hz)
    setHz(hzs.includes(currentHz) ? currentHz : (hzs[0] ?? ''))
  }

  function hzList(modes: MonitorMode[], res: string): string[] {
    const [w, h] = res.split('x').map(Number)
    return [...new Set(
      modes.filter(m => m.width === w && m.height === h).map(m => String(m.hz))
    )].sort((a, b) => Number(b) - Number(a))
  }

  const activeMonitor = useMemo(
    () => monitors.find(m => m.name === selectedMonitor),
    [monitors, selectedMonitor],
  )

  const resList = useMemo(() => {
    if (!activeMonitor) return []
    const seen = new Map<string, true>()
    for (const m of activeMonitor.modes) seen.set(`${m.width}x${m.height}`, true)
    return Array.from(seen.keys()).sort((a, b) => {
      const [aw, ah] = a.split('x').map(Number)
      const [bw, bh] = b.split('x').map(Number)
      return bw !== aw ? bw - aw : bh - ah
    })
  }, [activeMonitor])

  const hzOptions = useMemo(
    () => activeMonitor ? hzList(activeMonitor.modes, selectedRes) : [],
    [activeMonitor, selectedRes],
  )

  function onMonitorChange(name: string) {
    setSelected(name)
    const m = monitors.find(x => x.name === name)
    if (m) populateSelects(m)
  }

  function onResChange(res: string) {
    setRes(res)
    setHz(activeMonitor ? hzList(activeMonitor.modes, res)[0] ?? '' : '')
  }

  async function applyTo(deviceNames: string[], width: number, height: number, hz: number) {
    setApplying(true)
    setApplyResult(null)
    try {
      const results = await Promise.all(
        deviceNames.map(name => window.api.monitorSetResolution(name, width, height, hz))
      )
      const ok = results.every(r => r === 0)
      setApplyResult(ok ? 'success' : 'error')
      if (ok) setTimeout(() => loadMonitors(), 500)
    } catch {
      setApplyResult('error')
    } finally {
      setApplying(false)
      setTimeout(() => setApplyResult(null), 2500)
    }
  }

  function applySingle() {
    if (!selectedMonitor || !selectedRes || !selectedHz) return
    const [w, h] = selectedRes.split('x').map(Number)
    applyTo([selectedMonitor], w, h, Number(selectedHz))
  }

  const activeIdx = monitors.findIndex(m => m.name === selectedMonitor)

  function isPresetActive(w: number, h: number, hz: number) {
    return monitors.length > 0 && monitors.every(m => m.width === w && m.height === h && m.hz === hz)
  }
  const desktopActive = isPresetActive(2560, 1440, 165)
  const iracingActive = isPresetActive(1920, 1080, 165)

  return (
    <div className="flex flex-col h-full -mx-4 -my-4">
      <div className="flex items-center px-5 py-3 border-b border-surface/10 shrink-0">
        <span className="text-xs font-mono font-semibold text-muted/40 tracking-widest uppercase">Monitor</span>
      </div>
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <span className="text-xs font-mono text-muted/30">Scanning monitors…</span>
        </div>
      ) : monitors.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-xs font-mono text-warn/60">No active monitors detected.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-5">
        <div className="space-y-3 max-w-3xl mx-auto">
          {/* Monitor map */}
          <MonitorMap monitors={monitors} selected={selectedMonitor} onSelect={onMonitorChange} />

          {/* Selected monitor label + current resolution */}
          <p className="text-xs font-mono text-center text-muted/50">
            <span className="text-accent font-semibold">{activeIdx + 1}</span>
            {' — '}{activeMonitor?.label || activeMonitor?.name || '—'}
            {activeMonitor?.width ? (
              <span className="text-muted/35"> ({activeMonitor.width}×{activeMonitor.height})</span>
            ) : null}
          </p>

          {/* Resolution + Hz row */}
          <div className="flex gap-3 pt-1">
            <div className="flex-1">
              <p className="text-xs font-mono text-muted/30 mb-1 uppercase tracking-wider">Resolution</p>
              <Select value={selectedRes} onChange={e => onResChange(e.target.value)}>
                {resList.map((r, i) => <option key={`res-${i}`} value={r}>{r}</option>)}
              </Select>
            </div>
            <div className="w-28">
              <p className="text-xs font-mono text-muted/30 mb-1 uppercase tracking-wider">Hz</p>
              <Select value={selectedHz} onChange={e => setHz(e.target.value)}>
                {hzOptions.map((h, i) => <option key={`hz-${i}`} value={h}>{h}</option>)}
              </Select>
            </div>
          </div>

          {/* Apply single + refresh */}
          <div className="flex gap-2">
            <button
              onClick={applySingle}
              disabled={applying || !selectedRes || !selectedHz}
              className="flex-1 h-9 rounded-md bg-accent/20 border border-accent/30 text-xs font-mono font-semibold text-accent hover:bg-accent/30 disabled:opacity-40 transition-colors"
            >
              Apply Single
            </button>
            <button
              onClick={loadMonitors}
              disabled={loading}
              className="h-9 px-4 rounded-md bg-surface/10 border border-surface/15 text-xs font-mono text-muted/50 hover:text-muted/80 hover:bg-surface/20 disabled:opacity-40 transition-colors"
            >
              Refresh
            </button>
          </div>

          {/* Presets */}
          <div className="pt-1 border-t border-surface/10">
            <p className="text-xs font-mono text-muted/30 mb-2 uppercase tracking-wider">All Monitors</p>
            <div className="flex gap-2">
              <button
                onClick={() => applyTo(monitors.map(m => m.name), 2560, 1440, 165)}
                disabled={applying}
                className={['flex-1 h-9 rounded-md border text-xs font-mono transition-colors disabled:opacity-40',
                  desktopActive
                    ? 'bg-accent/20 border-accent/40 text-accent font-semibold'
                    : 'bg-surface/10 border-surface/15 text-muted/60 hover:bg-surface/20 hover:text-muted/80',
                ].join(' ')}
              >
                {desktopActive && '✓ '}Desktop 2560×1440 165Hz
              </button>
              <button
                onClick={() => applyTo(monitors.map(m => m.name), 1920, 1080, 165)}
                disabled={applying}
                className={['flex-1 h-9 rounded-md border text-xs font-mono transition-colors disabled:opacity-40',
                  iracingActive
                    ? 'bg-accent/20 border-accent/40 text-accent font-semibold'
                    : 'bg-surface/10 border-surface/15 text-muted/60 hover:bg-surface/20 hover:text-muted/80',
                ].join(' ')}
              >
                {iracingActive && '✓ '}iRacing 1920×1080 165Hz
              </button>
            </div>
          </div>

          {applyResult && (
            <p className={`text-xs font-mono text-center ${applyResult === 'success' ? 'text-success' : 'text-warn'}`}>
              {applyResult === 'success' ? 'Resolution applied.' : 'Failed to apply resolution.'}
            </p>
          )}
        </div>
        </div>
      )}
    </div>
  )
})
