import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { Camera, ChevronDown, FolderOpen, Settings } from 'lucide-react'
import { useToolStore } from '@/store/toolStore'
import Panel from '@/components/ui/Panel'
import Button from '@/components/ui/Button'

const RESOLUTION_LABELS: Record<string, string> = {
  '1080p': '1080p  —  1920 × 1080',
  '2k':    '2K  —  2560 × 1440',
  '4k':    '4K  —  3840 × 2160',
  '5k':    '5K  —  5120 × 2880',
  '6k':    '6K  —  6400 × 3600',
  '7k':    '7K  —  7168 × 4032',
  '8k':    '8K  —  7680 × 4320',
  custom:  'Custom',
}

const FORMAT_LABELS: Record<string, string> = {
  jpeg: 'JPEG',
  png:  'PNG',
  webp: 'WebP',
}

const FILENAME_TOKENS = [
  '{track}', '{trackFull}', '{driver}', '{car}', '{carFull}',
  '{carClass}', '{sessionType}', '{lap}', '{date}', '{time}', '{datetime}', '{counter}',
]

// ─── capture helper (runs in renderer) ───────────────────────────────────────

async function captureFrame(
  sourceId: string | null,
  width: number,
  height: number,
): Promise<Buffer> {
  const constraints: MediaStreamConstraints = {
    audio: false,
    video: {
      // @ts-expect-error Electron extension
      mandatory: {
        chromeMediaSource: 'desktop',
        chromeMediaSourceId: sourceId ?? undefined,
        minWidth: 1280,
        maxWidth: 10000,
        minHeight: 720,
        maxHeight: 10000,
      },
    },
  }

  const stream = await navigator.mediaDevices.getUserMedia(constraints)
  const video = document.createElement('video')
  video.srcObject = stream
  await new Promise<void>((res) => { video.onloadedmetadata = () => { video.play(); res() } })

  // Wait for dimensions to match (up to 8s)
  const deadline = Date.now() + 8000
  while (Date.now() < deadline) {
    if (Math.abs(video.videoWidth - width) <= 2 && Math.abs(video.videoHeight - height) <= 2) break
    await new Promise((r) => setTimeout(r, 300))
  }

  const canvas = new OffscreenCanvas(video.videoWidth, video.videoHeight)
  const ctx = canvas.getContext('2d', { alpha: false })!
  ctx.drawImage(video, 0, 0)
  stream.getTracks().forEach((t) => t.stop())

  const blob = await canvas.convertToBlob({ type: 'image/png' })
  return Buffer.from(await blob.arrayBuffer())
}

// ─── Component ────────────────────────────────────────────────────────────────

export default memo(function IracingScreenshot() {
  const cfg        = useToolStore((s) => s.screenshot)
  const setCfg     = useToolStore((s) => s.setScreenshot)

  const [connected, setConnected]     = useState(false)
  const [taking, setTaking]           = useState(false)
  const [lastPath, setLastPath]       = useState<string | null>(null)
  const [error, setError]             = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [resOpen, setResOpen]         = useState(false)
  const [fmtOpen, setFmtOpen]         = useState(false)
  const resRef = useRef<HTMLDivElement>(null)
  const fmtRef = useRef<HTMLDivElement>(null)

  // Load default folder once
  useEffect(() => {
    if (!cfg.folder) {
      window.api.defaultScreenshotFolder().then((f) => setCfg({ folder: f }))
    }
    window.api.iracingStatus().then(setConnected)

    const unsub1 = window.api.onIracingConnected(() => setConnected(true))
    const unsub2 = window.api.onIracingDisconnected(() => setConnected(false))

    // Register capture listener — renderer does getUserMedia when main asks
    const unsub3 = window.api.onScreenshotCapture(async ({ sourceId, width, height }) => {
      try {
        const buf = await captureFrame(sourceId, width, height)
        window.api.submitScreenshotBuffer(buf)
      } catch (e) {
        window.api.submitScreenshotBuffer(Buffer.alloc(0))
        console.error('[screenshot capture]', e)
      }
    })

    return () => { unsub1(); unsub2(); unsub3() }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Close dropdowns on outside click
  useEffect(() => {
    if (!resOpen && !fmtOpen) return
    const h = (e: MouseEvent) => {
      if (!resRef.current?.contains(e.target as Node)) setResOpen(false)
      if (!fmtRef.current?.contains(e.target as Node)) setFmtOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [resOpen, fmtOpen])

  // Register global hotkey
  useEffect(() => {
    if (!cfg.hotkey) return
    window.api.setHotkey('screenshot', cfg.hotkey)
    return () => { window.api.clearHotkey('screenshot') }
  }, [cfg.hotkey])

  const takeScreenshot = useCallback(async () => {
    setTaking(true)
    setError(null)
    try {
      const result = await window.api.takeScreenshot(cfg)
      setLastPath(result.path)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Screenshot failed')
    } finally {
      setTaking(false)
    }
  }, [cfg])

  const pickFolder = useCallback(async () => {
    const f = await window.api.pickScreenshotFolder()
    if (f) setCfg({ folder: f })
  }, [setCfg])

  const detectScreen = useCallback(() => {
    const { width, height } = window.screen
    setCfg({ screenWidth: width, screenHeight: height })
  }, [setCfg])

  return (
    <Panel title="Screenshot">
      {/* iRacing status */}
      <div className="flex items-center justify-between mb-4">
        <span className={`inline-flex items-center gap-1.5 text-xs font-mono ${connected ? 'text-success' : 'text-muted/40'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-success' : 'bg-muted/30'}`} />
          {connected ? 'iRacing connected' : 'iRacing not running'}
        </span>
        <button onClick={() => setShowSettings((v) => !v)} className="text-muted/30 hover:text-muted/60 transition-colors">
          <Settings size={13} />
        </button>
      </div>

      {/* Resolution */}
      <div className="space-y-3 mb-4">
        <div ref={resRef} className="relative">
          <p className="text-xs font-mono text-muted/40 mb-1">Resolution</p>
          <button
            onClick={() => setResOpen((v) => !v)}
            className="w-full flex items-center justify-between bg-surface/10 border border-surface/15 rounded-md px-3 h-9 text-xs font-mono text-muted/70 hover:border-surface/30 transition-colors"
          >
            {RESOLUTION_LABELS[cfg.resolution]}
            <ChevronDown size={12} className={`transition-transform ${resOpen ? 'rotate-180' : ''}`} />
          </button>
          {resOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 rounded-md bg-app border border-surface/15 shadow-xl overflow-hidden z-50">
              {Object.entries(RESOLUTION_LABELS).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => { setCfg({ resolution: key as ScreenshotResolution }); setResOpen(false) }}
                  className={`w-full text-left px-3 py-2 text-xs font-mono transition-colors ${cfg.resolution === key ? 'text-accent bg-accent/10' : 'text-muted/50 hover:bg-surface/10'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        {cfg.resolution === 'custom' && (
          <div className="flex gap-2">
            <div className="flex-1">
              <p className="text-xs font-mono text-muted/40 mb-1">Width</p>
              <input
                type="number" min={640} max={10000}
                value={cfg.customWidth}
                onChange={(e) => setCfg({ customWidth: Number(e.target.value) })}
                className="w-full bg-surface/10 border border-surface/15 rounded-md px-3 h-9 text-xs font-mono text-muted/70 focus:outline-none focus:border-accent/40"
              />
            </div>
            <div className="flex-1">
              <p className="text-xs font-mono text-muted/40 mb-1">Height</p>
              <input
                type="number" min={360} max={10000}
                value={cfg.customHeight}
                onChange={(e) => setCfg({ customHeight: Number(e.target.value) })}
                className="w-full bg-surface/10 border border-surface/15 rounded-md px-3 h-9 text-xs font-mono text-muted/70 focus:outline-none focus:border-accent/40"
              />
            </div>
          </div>
        )}

        {/* Toggles */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-mono text-muted/60">Crop watermark</p>
            <p className="text-xs font-mono text-muted/25">Slightly zooms in to remove iRacing UI</p>
          </div>
          <Toggle value={cfg.crop} onChange={(v) => setCfg({ crop: v })} />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-mono text-muted/60">Keep aspect ratio</p>
            <p className="text-xs font-mono text-muted/25">
              {cfg.screenWidth > 0 ? `${cfg.screenWidth} × ${cfg.screenHeight}` : 'Screen not detected'}
              {' '}<button onClick={detectScreen} className="text-accent/60 hover:text-accent transition-colors">(detect)</button>
            </p>
          </div>
          <Toggle value={cfg.keepAspectRatio} onChange={(v) => setCfg({ keepAspectRatio: v })} />
        </div>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div className="border-t border-surface/10 pt-3 mb-4 space-y-3">
          {/* Output format */}
          <div ref={fmtRef} className="relative">
            <p className="text-xs font-mono text-muted/40 mb-1">Output format</p>
            <button
              onClick={() => setFmtOpen((v) => !v)}
              className="w-full flex items-center justify-between bg-surface/10 border border-surface/15 rounded-md px-3 h-9 text-xs font-mono text-muted/70 hover:border-surface/30 transition-colors"
            >
              {FORMAT_LABELS[cfg.outputFormat]}
              <ChevronDown size={12} className={`transition-transform ${fmtOpen ? 'rotate-180' : ''}`} />
            </button>
            {fmtOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 rounded-md bg-app border border-surface/15 shadow-xl overflow-hidden z-50">
                {Object.entries(FORMAT_LABELS).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => { setCfg({ outputFormat: key as 'jpeg' | 'png' | 'webp' }); setFmtOpen(false) }}
                    className={`w-full text-left px-3 py-2 text-xs font-mono transition-colors ${cfg.outputFormat === key ? 'text-accent bg-accent/10' : 'text-muted/50 hover:bg-surface/10'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Folder */}
          <div>
            <p className="text-xs font-mono text-muted/40 mb-1">Save folder</p>
            <div className="flex gap-2">
              <input
                readOnly value={cfg.folder}
                className="flex-1 min-w-0 bg-surface/10 border border-surface/15 rounded-md px-3 h-9 text-xs font-mono text-muted/50 cursor-default"
              />
              <button
                onClick={pickFolder}
                className="w-9 h-9 shrink-0 rounded-md bg-surface/10 border border-surface/15 text-muted/40 hover:text-muted/80 hover:bg-surface/20 transition-colors flex items-center justify-center"
              >
                <FolderOpen size={14} />
              </button>
            </div>
          </div>

          {/* Filename format */}
          <div>
            <p className="text-xs font-mono text-muted/40 mb-1">Filename format</p>
            <input
              value={cfg.filenameFormat}
              onChange={(e) => setCfg({ filenameFormat: e.target.value })}
              className="w-full bg-surface/10 border border-surface/15 rounded-md px-3 h-9 text-xs font-mono text-muted/70 focus:outline-none focus:border-accent/40"
            />
            <div className="flex flex-wrap gap-1 mt-1.5">
              {FILENAME_TOKENS.map((t) => (
                <button
                  key={t}
                  onClick={() => setCfg({ filenameFormat: cfg.filenameFormat + t })}
                  className="px-1.5 py-0.5 rounded text-xs font-mono text-muted/40 bg-surface/10 hover:text-accent hover:bg-accent/10 transition-colors"
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Hotkey */}
          <div>
            <p className="text-xs font-mono text-muted/40 mb-1">Hotkey</p>
            <input
              value={cfg.hotkey}
              onChange={(e) => setCfg({ hotkey: e.target.value })}
              placeholder="Control+PrintScreen"
              className="w-full bg-surface/10 border border-surface/15 rounded-md px-3 h-9 text-xs font-mono text-muted/70 focus:outline-none focus:border-accent/40"
            />
          </div>
        </div>
      )}

      {/* Screenshot button */}
      <Button
        variant={taking ? 'ghost' : 'primary'}
        onClick={takeScreenshot}
        disabled={!connected || taking}
      >
        <span className="flex items-center gap-2">
          <Camera size={14} />
          {taking ? 'Capturing…' : `Screenshot  •  ${cfg.hotkey}`}
        </span>
      </Button>

      {/* Feedback */}
      {error && (
        <p className="text-xs font-mono text-warn/70 mt-2 text-center">{error}</p>
      )}
      {lastPath && !error && (
        <p className="text-xs font-mono text-muted/30 mt-2 text-center truncate" title={lastPath}>
          {lastPath.split(/[\\/]/).pop()}
        </p>
      )}
    </Panel>
  )
})

// ─── Small toggle sub-component ───────────────────────────────────────────────

type ScreenshotResolution = '1080p' | '2k' | '4k' | '5k' | '6k' | '7k' | '8k' | 'custom'

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${value ? 'bg-accent/30' : 'bg-muted/20'}`}
    >
      <span className={`absolute top-1 w-4 h-4 rounded-full transition-all ${value ? 'left-6 bg-accent' : 'left-1 bg-muted/50'}`} />
    </button>
  )
}
