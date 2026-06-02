import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { Camera, ChevronDown, ExternalLink, FolderOpen, RefreshCw, Settings, X } from 'lucide-react'
import { useToolStore } from '@/store/toolStore'

// ─── Constants ────────────────────────────────────────────────────────────────

const RESOLUTION_PRESETS: Record<string, { w: number; h: number }> = {
  '1080p': { w: 1920,  h: 1080 },
  '2k':    { w: 2560,  h: 1440 },
  '4k':    { w: 3840,  h: 2160 },
  '5k':    { w: 5120,  h: 2880 },
  '6k':    { w: 6400,  h: 3600 },
  '7k':    { w: 7168,  h: 4032 },
  '8k':    { w: 7680,  h: 4320 },
  custom:  { w: 0,     h: 0    },
}

const FORMAT_LABELS: Record<string, string> = { jpeg: 'JPEG', png: 'PNG', webp: 'WebP' }

const FILENAME_TOKENS = [
  '{track}', '{trackFull}', '{driver}', '{car}', '{carFull}',
  '{carClass}', '{sessionType}', '{lap}', '{date}', '{time}', '{datetime}', '{counter}',
]

type Resolution = keyof typeof RESOLUTION_PRESETS

// ─── Renderer capture ─────────────────────────────────────────────────────────

async function acquireStream(sourceId: string | null, w: number, h: number): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      // @ts-expect-error Electron extension
      mandatory: {
        chromeMediaSource: 'desktop',
        chromeMediaSourceId: sourceId ?? undefined,
        minWidth: 1280, maxWidth: 10000,
        minHeight: 720, maxHeight: 10000,
      },
    },
  })
}

async function probeStreamDimensions(stream: MediaStream): Promise<{ w: number; h: number }> {
  return new Promise((resolve) => {
    const v = document.createElement('video')
    v.srcObject = stream
    v.onloadedmetadata = () => resolve({ w: v.videoWidth, h: v.videoHeight })
    v.play()
  })
}

async function captureFrame(sourceId: string | null, width: number, height: number): Promise<Buffer> {
  const DIM_TOL = 2, RETRY = 300, MAX = 8000
  let stream = await acquireStream(sourceId, width, height)
  let dims   = await probeStreamDimensions(stream)
  const t0   = Date.now()
  while ((Math.abs(dims.w - width) > DIM_TOL || Math.abs(dims.h - height) > DIM_TOL) && Date.now() - t0 < MAX) {
    stream.getTracks().forEach((t) => t.stop())
    await new Promise((r) => setTimeout(r, RETRY))
    stream = await acquireStream(sourceId, width, height)
    dims   = await probeStreamDimensions(stream)
  }
  const v = document.createElement('video')
  v.srcObject = stream
  await new Promise<void>((r) => { v.onloadedmetadata = () => { v.play(); r() } })
  const canvas = new OffscreenCanvas(dims.w, dims.h)
  const ctx = canvas.getContext('2d', { alpha: false })!
  ctx.drawImage(v, 0, 0)
  stream.getTracks().forEach((t) => t.stop())
  const blob = await canvas.convertToBlob({ type: 'image/png' })
  return Buffer.from(await blob.arrayBuffer())
}

// ─── Component ────────────────────────────────────────────────────────────────

interface GalleryEntry { path: string; name: string; thumb: string | null; mtime: number }

const toFileUrl = (p: string) => `localfile:///${p.replace(/\\/g, '/')}`

export default memo(function IracingScreenshot() {
  const cfg    = useToolStore((s) => s.screenshot)
  const setCfg = useToolStore((s) => s.setScreenshot)

  const [connected, setConnected]   = useState(false)
  const [taking, setTaking]         = useState(false)
  const [preview, setPreview]       = useState<string | null>(null)
  const [gallery, setGallery]       = useState<GalleryEntry[]>([])
  const [selected, setSelected]     = useState<GalleryEntry | null>(null)
  const [error, setError]           = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [resOpen, setResOpen]       = useState(false)
  const [fmtOpen, setFmtOpen]       = useState(false)
  const resRef  = useRef<HTMLDivElement>(null)
  const fmtRef  = useRef<HTMLDivElement>(null)

  const targetDims = (() => {
    if (cfg.resolution === 'custom') return { w: cfg.customWidth, h: cfg.customHeight }
    const p = RESOLUTION_PRESETS[cfg.resolution]
    if (cfg.keepAspectRatio && cfg.screenWidth > 0)
      return { w: p.w, h: Math.round((p.w * cfg.screenHeight) / cfg.screenWidth) }
    return p
  })()

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!cfg.folder) window.api.defaultScreenshotFolder().then((f) => setCfg({ folder: f }))
    window.api.iracingStatus().then(setConnected)
    const u1 = window.api.onIracingConnected(() => setConnected(true))
    const u2 = window.api.onIracingDisconnected(() => setConnected(false))
    const u3 = window.api.onScreenshotCapture(async ({ sourceId, width, height }) => {
      try { window.api.submitScreenshotBuffer(await captureFrame(sourceId, width, height)) }
      catch { window.api.submitScreenshotBuffer(Buffer.alloc(0)) }
    })
    const u4 = window.api.onScreenshotHotkey(() => { if (!taking) void take() })
    return () => { u1(); u2(); u3(); u4() }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (cfg.hotkey) window.api.setScreenshotHotkey(cfg.hotkey)
    return () => { window.api.clearScreenshotHotkey() }
  }, [cfg.hotkey])

  // close dropdowns on outside click
  useEffect(() => {
    if (!resOpen && !fmtOpen) return
    const h = (e: MouseEvent) => {
      if (!resRef.current?.contains(e.target as Node)) setResOpen(false)
      if (!fmtRef.current?.contains(e.target as Node)) setFmtOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [resOpen, fmtOpen])

  const loadGallery = useCallback(async () => {
    if (!cfg.folder) return
    const entries = await window.api.listScreenshots(cfg.folder)
    setGallery(entries)
    if (entries[0] && !selected) {
      setSelected(entries[0])
      if (entries[0].thumb) setPreview(entries[0].thumb)
    }
  }, [cfg.folder]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { void loadGallery() }, [loadGallery])

  // ── Screenshot ────────────────────────────────────────────────────────────
  const take = useCallback(async () => {
    setTaking(true)
    setError(null)
    try {
      const result = await window.api.takeScreenshot(cfg)
      if (result.thumb) setPreview(result.thumb)
      void loadGallery()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Screenshot failed')
    } finally {
      setTaking(false)
    }
  }, [cfg, loadGallery])

  const pickFolder = async () => {
    const f = await window.api.pickScreenshotFolder()
    if (f) setCfg({ folder: f })
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full overflow-hidden">

      {/* ── Left sidebar ─────────────────────────────────────────────────── */}
      <div className="w-56 shrink-0 flex flex-col border-r border-surface/10 overflow-y-auto">
        <div className="p-4 space-y-4 flex-1">

          {/* iRacing status */}
          <div className={`flex items-center gap-2 text-xs font-mono ${connected ? 'text-success' : 'text-muted/40'}`}>
            <span className={`w-2 h-2 rounded-full shrink-0 ${connected ? 'bg-success' : 'bg-muted/30'}`} />
            {connected ? 'iRacing connected' : 'Not connected'}
          </div>

          {/* Resolution */}
          <div ref={resRef} className="relative">
            <p className="text-xs font-mono text-muted/40 mb-1 uppercase tracking-wider">Resolution</p>
            <button onClick={() => setResOpen((v) => !v)}
              className="w-full flex items-center justify-between bg-surface/10 border border-surface/15 rounded-md px-3 h-8 text-xs font-mono text-muted/70 hover:border-surface/30 transition-colors">
              {cfg.resolution.toUpperCase()}
              <ChevronDown size={11} className={`transition-transform ${resOpen ? 'rotate-180' : ''}`} />
            </button>
            {resOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 rounded-md bg-app border border-surface/15 shadow-xl overflow-hidden z-50">
                {Object.keys(RESOLUTION_PRESETS).map((key) => (
                  <button key={key} onClick={() => { setCfg({ resolution: key as Resolution }); setResOpen(false) }}
                    className={`w-full text-left px-3 py-2 text-xs font-mono transition-colors ${cfg.resolution === key ? 'text-accent bg-accent/10' : 'text-muted/50 hover:bg-surface/10'}`}>
                    {key === 'custom' ? 'Custom' : `${key.toUpperCase()}  —  ${RESOLUTION_PRESETS[key].w} × ${RESOLUTION_PRESETS[key].h}`}
                  </button>
                ))}
              </div>
            )}
          </div>

          {cfg.resolution === 'custom' && (
            <div className="flex gap-2">
              <div className="flex-1">
                <p className="text-xs font-mono text-muted/40 mb-1">W</p>
                <input type="number" min={640} max={10000} value={cfg.customWidth}
                  onChange={(e) => setCfg({ customWidth: Number(e.target.value) })}
                  className="w-full bg-surface/10 border border-surface/15 rounded-md px-2 h-8 text-xs font-mono text-muted/70 focus:outline-none focus:border-accent/40" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-mono text-muted/40 mb-1">H</p>
                <input type="number" min={360} max={10000} value={cfg.customHeight}
                  onChange={(e) => setCfg({ customHeight: Number(e.target.value) })}
                  className="w-full bg-surface/10 border border-surface/15 rounded-md px-2 h-8 text-xs font-mono text-muted/70 focus:outline-none focus:border-accent/40" />
              </div>
            </div>
          )}

          <p className="text-xs font-mono text-muted/30">
            Target: <span className="text-muted/60">{targetDims.w} × {targetDims.h}</span>
          </p>

          {/* Crop watermark */}
          <SidebarToggle
            label="Crop Watermark"
            desc="Removes iRacing UI overlay"
            value={cfg.crop}
            onChange={(v) => setCfg({ crop: v })}
          />

          {cfg.crop && (
            <SidebarToggle
              label="Crop from top-left"
              desc={cfg.cropTopLeft ? 'Top-left mode' : 'Center mode (default)'}
              value={cfg.cropTopLeft}
              onChange={(v) => setCfg({ cropTopLeft: v })}
            />
          )}

          {/* Keep aspect ratio */}
          <SidebarToggle
            label="Keep Aspect Ratio"
            desc={cfg.screenWidth > 0 ? `${cfg.screenWidth}×${cfg.screenHeight}` : 'Screen not detected'}
            value={cfg.keepAspectRatio}
            onChange={(v) => setCfg({ keepAspectRatio: v })}
            action={<button onClick={() => setCfg({ screenWidth: window.screen.width, screenHeight: window.screen.height })}
              className="text-accent/60 hover:text-accent text-xs font-mono transition-colors">detect</button>}
          />

          {/* Screenshot button */}
          <button
            onClick={take}
            disabled={!connected || taking}
            className={[
              'w-full py-2.5 rounded-md font-mono font-semibold text-sm transition-colors border',
              connected && !taking
                ? 'bg-warn/20 border-warn/30 text-warn hover:bg-warn/30'
                : 'opacity-40 cursor-not-allowed bg-surface/10 border-surface/15 text-muted/50',
            ].join(' ')}
          >
            <span className="flex items-center justify-center gap-2">
              <Camera size={14} />
              {taking ? 'Capturing…' : 'Screenshot'}
            </span>
          </button>

          {cfg.hotkey && (
            <p className="text-xs font-mono text-muted/25 text-center">{cfg.hotkey}</p>
          )}

          {error && (
            <div className="flex items-start gap-1.5">
              <p className="text-xs font-mono text-warn/70 flex-1 leading-relaxed">{error}</p>
              <button onClick={() => setError(null)} className="text-muted/30 hover:text-muted/60 shrink-0 mt-0.5"><X size={11} /></button>
            </div>
          )}
        </div>

        {/* Settings toggle */}
        <div className="border-t border-surface/10 p-2">
          <button onClick={() => setShowSettings((v) => !v)}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs font-mono transition-colors ${showSettings ? 'text-accent bg-accent/10' : 'text-muted/40 hover:text-muted/70 hover:bg-surface/10'}`}>
            <Settings size={12} />
            Settings
          </button>
        </div>
      </div>

      {/* ── Settings panel (slides in over main) ─────────────────────────── */}
      {showSettings ? (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-md space-y-4">
            <p className="text-xs font-mono font-semibold text-muted/40 tracking-widest uppercase mb-4">Screenshot Settings</p>

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
                  className="w-9 h-9 shrink-0 rounded-md bg-surface/10 border border-surface/15 text-muted/40 hover:text-muted/80 transition-colors flex items-center justify-center">
                  <FolderOpen size={14} />
                </button>
              </div>
            </div>

            {/* Filename format */}
            <div>
              <p className="text-xs font-mono text-muted/40 mb-1">Filename format</p>
              <input value={cfg.filenameFormat} onChange={(e) => setCfg({ filenameFormat: e.target.value })}
                className="w-full bg-surface/10 border border-surface/15 rounded-md px-3 h-9 text-xs font-mono text-muted/70 focus:outline-none focus:border-accent/40" />
              <div className="flex flex-wrap gap-1 mt-2">
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
            <SidebarToggle label="Manual window restore" desc="Skip auto-restore if it causes issues"
              value={cfg.manualRestore} onChange={(v) => setCfg({ manualRestore: v })} />
          </div>
        </div>
      ) : (

        /* ── Preview + gallery ─────────────────────────────────────────── */
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Preview */}
          <div className="flex-1 bg-black/30 flex items-center justify-center overflow-hidden relative">
            {preview || selected?.thumb ? (
              <>
                <img
                  src={toFileUrl(preview ?? selected?.thumb ?? '')}
                  alt="preview"
                  className="max-w-full max-h-full object-contain"
                />
                {selected && (
                  <button
                    onClick={() => window.api.openScreenshot(selected.path)}
                    className="absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-black/60 hover:bg-black/80 text-xs font-mono text-white/70 hover:text-white transition-colors"
                  >
                    <ExternalLink size={11} />
                    Show in folder
                  </button>
                )}
                {selected && (
                  <p className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-md bg-black/60 text-xs font-mono text-white/50">
                    {selected.name}
                  </p>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center gap-3 text-muted/20">
                <Camera size={48} strokeWidth={1} />
                <p className="text-xs font-mono">No screenshots yet</p>
              </div>
            )}
          </div>

          {/* Thumbnail strip */}
          <div className="h-28 shrink-0 border-t border-surface/10 flex items-center gap-2 px-3 overflow-x-auto">
            <button onClick={loadGallery} className="shrink-0 w-8 h-20 rounded-md border border-surface/15 bg-surface/10 flex items-center justify-center text-muted/30 hover:text-muted/60 transition-colors" title="Refresh">
              <RefreshCw size={14} />
            </button>
            {gallery.map((entry) => (
              <button
                key={entry.path}
                onClick={() => { setSelected(entry); setPreview(entry.thumb) }}
                className={[
                  'shrink-0 h-20 w-36 rounded-md overflow-hidden border-2 transition-all',
                  selected?.path === entry.path ? 'border-accent' : 'border-surface/15 hover:border-surface/40',
                ].join(' ')}
              >
                {entry.thumb ? (
                  <img src={toFileUrl(entry.thumb ?? '')} alt={entry.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-surface/10 flex items-center justify-center">
                    <Camera size={14} className="text-muted/20" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
})

// ─── Sidebar toggle row ───────────────────────────────────────────────────────

function SidebarToggle({ label, desc, value, onChange, action }: {
  label: string
  desc: string
  value: boolean
  onChange: (v: boolean) => void
  action?: React.ReactNode
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-mono text-muted/70 font-semibold">{label}</p>
        <button onClick={() => onChange(!value)}
          className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${value ? 'bg-accent/30' : 'bg-muted/20'}`}>
          <span className={`absolute top-0.5 w-4 h-4 rounded-full transition-all ${value ? 'left-4 bg-accent' : 'left-0.5 bg-muted/50'}`} />
        </button>
      </div>
      <p className="text-xs font-mono text-muted/30">{desc} {action}</p>
    </div>
  )
}
