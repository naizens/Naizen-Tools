import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { Camera, ChevronDown, ExternalLink, FolderOpen, Images, Settings, X } from 'lucide-react'
import { useToolStore } from '@/store/toolStore'
import Panel from '@/components/ui/Panel'
import Button from '@/components/ui/Button'

// ─── Constants ────────────────────────────────────────────────────────────────

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

const FORMAT_LABELS: Record<string, string> = { jpeg: 'JPEG', png: 'PNG', webp: 'WebP' }

const FILENAME_TOKENS = [
  '{track}', '{trackFull}', '{driver}', '{car}', '{carFull}',
  '{carClass}', '{sessionType}', '{lap}', '{date}', '{time}', '{datetime}', '{counter}',
]

type View = 'main' | 'settings' | 'gallery'
type Resolution = '1080p' | '2k' | '4k' | '5k' | '6k' | '7k' | '8k' | 'custom'

// ─── Renderer capture (getUserMedia) ─────────────────────────────────────────

async function acquireStream(sourceId: string | null, width: number, height: number): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      // @ts-expect-error Electron extension
      mandatory: {
        chromeMediaSource: 'desktop',
        chromeMediaSourceId: sourceId ?? undefined,
        minWidth: 1280, maxWidth: 10000,
        minHeight: 720,  maxHeight: 10000,
      },
    },
  })
}

async function probeStreamDimensions(stream: MediaStream): Promise<{ w: number; h: number }> {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    video.srcObject = stream
    video.onloadedmetadata = () => resolve({ w: video.videoWidth, h: video.videoHeight })
    video.play()
  })
}

async function captureFrame(sourceId: string | null, width: number, height: number): Promise<Buffer> {
  const DIM_TOLERANCE = 2
  const RETRY_DELAY  = 300
  const MAX_WAIT     = 8000

  let stream = await acquireStream(sourceId, width, height)
  let dims   = await probeStreamDimensions(stream)
  const start = Date.now()

  while (
    (Math.abs(dims.w - width) > DIM_TOLERANCE || Math.abs(dims.h - height) > DIM_TOLERANCE) &&
    Date.now() - start < MAX_WAIT
  ) {
    stream.getTracks().forEach((t) => t.stop())
    await new Promise((r) => setTimeout(r, RETRY_DELAY))
    stream = await acquireStream(sourceId, width, height)
    dims   = await probeStreamDimensions(stream)
  }

  const video = document.createElement('video')
  video.srcObject = stream
  await new Promise<void>((r) => { video.onloadedmetadata = () => { video.play(); r() } })

  const canvas = new OffscreenCanvas(dims.w, dims.h)
  const ctx = canvas.getContext('2d', { alpha: false })!
  ctx.drawImage(video, 0, 0)
  stream.getTracks().forEach((t) => t.stop())

  const blob = await canvas.convertToBlob({ type: 'image/png' })
  return Buffer.from(await blob.arrayBuffer())
}

// ─── Component ────────────────────────────────────────────────────────────────

interface GalleryEntry { path: string; name: string; thumb: string | null; mtime: number }

export default memo(function IracingScreenshot() {
  const cfg    = useToolStore((s) => s.screenshot)
  const setCfg = useToolStore((s) => s.setScreenshot)

  const [connected, setConnected] = useState(false)
  const [taking, setTaking]       = useState(false)
  const [lastPath, setLastPath]   = useState<string | null>(null)
  const [error, setError]         = useState<string | null>(null)
  const [view, setView]           = useState<View>('main')
  const [gallery, setGallery]     = useState<GalleryEntry[]>([])
  const [resOpen, setResOpen]     = useState(false)
  const [fmtOpen, setFmtOpen]     = useState(false)
  const resRef = useRef<HTMLDivElement>(null)
  const fmtRef = useRef<HTMLDivElement>(null)

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!cfg.folder) window.api.defaultScreenshotFolder().then((f) => setCfg({ folder: f }))
    window.api.iracingStatus().then(setConnected)

    const unsub1 = window.api.onIracingConnected(() => setConnected(true))
    const unsub2 = window.api.onIracingDisconnected(() => setConnected(false))

    const unsub3 = window.api.onScreenshotCapture(async ({ sourceId, width, height }) => {
      try {
        const buf = await captureFrame(sourceId, width, height)
        window.api.submitScreenshotBuffer(buf)
      } catch (e) {
        window.api.submitScreenshotBuffer(Buffer.alloc(0))
        console.error('[screenshot capture]', e)
      }
    })

    const unsub4 = window.api.onScreenshotHotkey(() => {
      if (!taking) void handleTakeScreenshot()
    })

    return () => { unsub1(); unsub2(); unsub3(); unsub4() }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Register screenshot hotkey directly via globalShortcut ────────────────
  useEffect(() => {
    if (cfg.hotkey) window.api.setScreenshotHotkey(cfg.hotkey)
    return () => { window.api.clearScreenshotHotkey() }
  }, [cfg.hotkey])

  // ── Close dropdowns on outside click ─────────────────────────────────────
  useEffect(() => {
    if (!resOpen && !fmtOpen) return
    const h = (e: MouseEvent) => {
      if (!resRef.current?.contains(e.target as Node)) setResOpen(false)
      if (!fmtRef.current?.contains(e.target as Node)) setFmtOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [resOpen, fmtOpen])

  // ── Gallery load ──────────────────────────────────────────────────────────
  const loadGallery = useCallback(async () => {
    if (!cfg.folder) return
    const entries = await window.api.listScreenshots(cfg.folder)
    setGallery(entries)
  }, [cfg.folder])

  useEffect(() => {
    if (view === 'gallery') void loadGallery()
  }, [view, loadGallery])

  // ── Screenshot ────────────────────────────────────────────────────────────
  const handleTakeScreenshot = useCallback(async () => {
    setTaking(true)
    setError(null)
    try {
      const result = await window.api.takeScreenshot(cfg)
      setLastPath(result.path)
      if (view === 'gallery') void loadGallery()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Screenshot failed')
    } finally {
      setTaking(false)
    }
  }, [cfg, view, loadGallery])

  const pickFolder = useCallback(async () => {
    const f = await window.api.pickScreenshotFolder()
    if (f) setCfg({ folder: f })
  }, [setCfg])

  const detectScreen = useCallback(() => {
    setCfg({ screenWidth: window.screen.width, screenHeight: window.screen.height })
  }, [setCfg])

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <Panel title="Screenshot">
      {/* Status bar */}
      <div className="flex items-center justify-between mb-4">
        <span className={`inline-flex items-center gap-1.5 text-xs font-mono ${connected ? 'text-success' : 'text-muted/40'}`}>
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${connected ? 'bg-success' : 'bg-muted/30'}`} />
          {connected ? 'iRacing connected' : 'iRacing not running'}
        </span>
        <div className="flex items-center gap-1">
          <button onClick={() => setView(view === 'gallery' ? 'main' : 'gallery')}
            className={`p-1 rounded transition-colors ${view === 'gallery' ? 'text-accent' : 'text-muted/30 hover:text-muted/60'}`}>
            <Images size={13} />
          </button>
          <button onClick={() => setView(view === 'settings' ? 'main' : 'settings')}
            className={`p-1 rounded transition-colors ${view === 'settings' ? 'text-accent' : 'text-muted/30 hover:text-muted/60'}`}>
            <Settings size={13} />
          </button>
        </div>
      </div>

      {/* ── Main view ──────────────────────────────────────────────────────── */}
      {view === 'main' && (
        <div className="space-y-3 mb-4">
          {/* Resolution */}
          <div ref={resRef} className="relative">
            <p className="text-xs font-mono text-muted/40 mb-1">Resolution</p>
            <button onClick={() => setResOpen((v) => !v)}
              className="w-full flex items-center justify-between bg-surface/10 border border-surface/15 rounded-md px-3 h-9 text-xs font-mono text-muted/70 hover:border-surface/30 transition-colors">
              {RESOLUTION_LABELS[cfg.resolution]}
              <ChevronDown size={12} className={`transition-transform ${resOpen ? 'rotate-180' : ''}`} />
            </button>
            {resOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 rounded-md bg-app border border-surface/15 shadow-xl overflow-hidden z-50">
                {Object.entries(RESOLUTION_LABELS).map(([key, label]) => (
                  <button key={key} onClick={() => { setCfg({ resolution: key as Resolution }); setResOpen(false) }}
                    className={`w-full text-left px-3 py-2 text-xs font-mono transition-colors ${cfg.resolution === key ? 'text-accent bg-accent/10' : 'text-muted/50 hover:bg-surface/10'}`}>
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
                <input type="number" min={640} max={10000} value={cfg.customWidth}
                  onChange={(e) => setCfg({ customWidth: Number(e.target.value) })}
                  className="w-full bg-surface/10 border border-surface/15 rounded-md px-3 h-9 text-xs font-mono text-muted/70 focus:outline-none focus:border-accent/40" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-mono text-muted/40 mb-1">Height</p>
                <input type="number" min={360} max={10000} value={cfg.customHeight}
                  onChange={(e) => setCfg({ customHeight: Number(e.target.value) })}
                  className="w-full bg-surface/10 border border-surface/15 rounded-md px-3 h-9 text-xs font-mono text-muted/70 focus:outline-none focus:border-accent/40" />
              </div>
            </div>
          )}

          <ToggleRow label="Crop watermark" desc="Removes iRacing UI overlay (6% zoom)">
            <Toggle value={cfg.crop} onChange={(v) => setCfg({ crop: v })} />
          </ToggleRow>

          {cfg.crop && (
            <ToggleRow label="Crop from top-left" desc={cfg.cropTopLeft ? 'Top-left mode' : 'Center mode (default)'}>
              <Toggle value={cfg.cropTopLeft} onChange={(v) => setCfg({ cropTopLeft: v })} />
            </ToggleRow>
          )}

          <ToggleRow
            label="Keep aspect ratio"
            desc={cfg.screenWidth > 0
              ? `${cfg.screenWidth} × ${cfg.screenHeight} — `
              : 'Not detected — '}
            descAction={<button onClick={detectScreen} className="text-accent/60 hover:text-accent transition-colors">detect</button>}
          >
            <Toggle value={cfg.keepAspectRatio} onChange={(v) => setCfg({ keepAspectRatio: v })} />
          </ToggleRow>
        </div>
      )}

      {/* ── Settings view ──────────────────────────────────────────────────── */}
      {view === 'settings' && (
        <div className="space-y-3 mb-4">
          {/* Format */}
          <div ref={fmtRef} className="relative">
            <p className="text-xs font-mono text-muted/40 mb-1">Output format</p>
            <button onClick={() => setFmtOpen((v) => !v)}
              className="w-full flex items-center justify-between bg-surface/10 border border-surface/15 rounded-md px-3 h-9 text-xs font-mono text-muted/70 hover:border-surface/30 transition-colors">
              {FORMAT_LABELS[cfg.outputFormat]}
              <ChevronDown size={12} className={`transition-transform ${fmtOpen ? 'rotate-180' : ''}`} />
            </button>
            {fmtOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 rounded-md bg-app border border-surface/15 shadow-xl overflow-hidden z-50">
                {Object.entries(FORMAT_LABELS).map(([key, label]) => (
                  <button key={key} onClick={() => { setCfg({ outputFormat: key as 'jpeg' | 'png' | 'webp' }); setFmtOpen(false) }}
                    className={`w-full text-left px-3 py-2 text-xs font-mono transition-colors ${cfg.outputFormat === key ? 'text-accent bg-accent/10' : 'text-muted/50 hover:bg-surface/10'}`}>
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
              <input readOnly value={cfg.folder}
                className="flex-1 min-w-0 bg-surface/10 border border-surface/15 rounded-md px-3 h-9 text-xs font-mono text-muted/50 cursor-default" />
              <button onClick={pickFolder}
                className="w-9 h-9 shrink-0 rounded-md bg-surface/10 border border-surface/15 text-muted/40 hover:text-muted/80 hover:bg-surface/20 transition-colors flex items-center justify-center">
                <FolderOpen size={14} />
              </button>
            </div>
          </div>

          {/* Filename format */}
          <div>
            <p className="text-xs font-mono text-muted/40 mb-1">Filename format</p>
            <input value={cfg.filenameFormat} onChange={(e) => setCfg({ filenameFormat: e.target.value })}
              className="w-full bg-surface/10 border border-surface/15 rounded-md px-3 h-9 text-xs font-mono text-muted/70 focus:outline-none focus:border-accent/40" />
            <div className="flex flex-wrap gap-1 mt-1.5">
              {FILENAME_TOKENS.map((t) => (
                <button key={t} onClick={() => setCfg({ filenameFormat: cfg.filenameFormat + t })}
                  className="px-1.5 py-0.5 rounded text-xs font-mono text-muted/40 bg-surface/10 hover:text-accent hover:bg-accent/10 transition-colors">
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Hotkey */}
          <div>
            <p className="text-xs font-mono text-muted/40 mb-1">Hotkey</p>
            <input value={cfg.hotkey} onChange={(e) => setCfg({ hotkey: e.target.value })}
              placeholder="Control+PrintScreen"
              className="w-full bg-surface/10 border border-surface/15 rounded-md px-3 h-9 text-xs font-mono text-muted/70 focus:outline-none focus:border-accent/40" />
          </div>

          {/* Manual restore */}
          <ToggleRow label="Manual window restore" desc="Skip auto-restore if it causes issues">
            <Toggle value={cfg.manualRestore} onChange={(v) => setCfg({ manualRestore: v })} />
          </ToggleRow>
        </div>
      )}

      {/* ── Gallery view ───────────────────────────────────────────────────── */}
      {view === 'gallery' && (
        <div className="mb-4">
          {gallery.length === 0 ? (
            <div className="flex flex-col items-center py-8 gap-2">
              <Images size={28} className="text-muted/20" />
              <p className="text-xs font-mono text-muted/30">No screenshots yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
              {gallery.map((entry) => (
                <div key={entry.path} className="relative group rounded-md overflow-hidden bg-surface/10 border border-surface/10 aspect-video">
                  {entry.thumb ? (
                    <img src={`file://${entry.thumb}`} alt={entry.name}
                      className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Images size={16} className="text-muted/20" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                    <p className="text-xs font-mono text-white/70 px-2 text-center truncate w-full">{entry.name}</p>
                    <button onClick={() => window.api.openScreenshot(entry.path)}
                      className="flex items-center gap-1 px-2 py-1 rounded bg-white/20 hover:bg-white/30 text-xs font-mono text-white transition-colors">
                      <ExternalLink size={10} /> Show in folder
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <button onClick={loadGallery} className="mt-2 text-xs font-mono text-muted/30 hover:text-muted/60 transition-colors w-full text-center">
            Refresh
          </button>
        </div>
      )}

      {/* Screenshot button */}
      <Button variant={taking ? 'ghost' : 'primary'} onClick={handleTakeScreenshot} disabled={!connected || taking}>
        <span className="flex items-center gap-2">
          <Camera size={14} />
          {taking ? 'Capturing…' : `Screenshot  •  ${cfg.hotkey}`}
        </span>
      </Button>

      {error && (
        <div className="flex items-start gap-2 mt-2">
          <p className="text-xs font-mono text-warn/70 flex-1">{error}</p>
          <button onClick={() => setError(null)} className="text-muted/30 hover:text-muted/60 shrink-0"><X size={12} /></button>
        </div>
      )}
      {lastPath && !error && (
        <p className="text-xs font-mono text-muted/30 mt-2 text-center truncate cursor-pointer hover:text-muted/60 transition-colors"
          title={lastPath} onClick={() => window.api.openScreenshot(lastPath)}>
          {lastPath.split(/[\\/]/).pop()}
        </p>
      )}
    </Panel>
  )
})

// ─── Sub-components ───────────────────────────────────────────────────────────

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!value)}
      className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${value ? 'bg-accent/30' : 'bg-muted/20'}`}>
      <span className={`absolute top-1 w-4 h-4 rounded-full transition-all ${value ? 'left-6 bg-accent' : 'left-1 bg-muted/50'}`} />
    </button>
  )
}

function ToggleRow({ label, desc, descAction, children }: {
  label: string
  desc: string
  descAction?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs font-mono text-muted/60">{label}</p>
        <p className="text-xs font-mono text-muted/25 truncate">{desc}{descAction}</p>
      </div>
      {children}
    </div>
  )
}
