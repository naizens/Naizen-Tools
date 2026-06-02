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
        <div className="p-4 space-y-5 flex-1">

          {/* iRacing status */}
          <div className={`flex items-center gap-2 text-xs font-mono ${connected ? 'text-success' : 'text-muted/40'}`}>
            <span className={`w-2 h-2 rounded-full shrink-0 ${connected ? 'bg-success' : 'bg-muted/30'}`} />
            {connected ? 'iRacing connected' : 'Not connected'}
          </div>

          {/* Resolution */}
          <div ref={resRef} className="relative space-y-1.5">
            <p className="text-sm font-semibold text-muted/80">Resolution</p>
            <button onClick={() => setResOpen((v) => !v)}
              className="w-full flex items-center justify-between bg-surface/10 border border-surface/15 rounded-md px-3 h-9 text-sm font-mono text-muted/70 hover:border-surface/30 transition-colors">
              {cfg.resolution.toUpperCase()}
              <ChevronDown size={13} className={`transition-transform ${resOpen ? 'rotate-180' : ''}`} />
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
            <p className="text-xs font-mono text-muted/40">Target: {targetDims.w} × {targetDims.h}</p>
            {(cfg.resolution === '7k' || cfg.resolution === '8k') && (
              <p className="text-xs text-amber/70 leading-relaxed">
                High resolutions may crash iRacing if you run out of VRAM.
              </p>
            )}
          </div>

          {cfg.resolution === 'custom' && (
            <div className="flex gap-2">
              <div className="flex-1">
                <p className="text-xs font-mono text-muted/40 mb-1">Width</p>
                <input type="number" min={640} max={10000} value={cfg.customWidth}
                  onChange={(e) => setCfg({ customWidth: Number(e.target.value) })}
                  className="w-full bg-surface/10 border border-surface/15 rounded-md px-2 h-8 text-xs font-mono text-muted/70 focus:outline-none focus:border-accent/40" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-mono text-muted/40 mb-1">Height</p>
                <input type="number" min={360} max={10000} value={cfg.customHeight}
                  onChange={(e) => setCfg({ customHeight: Number(e.target.value) })}
                  className="w-full bg-surface/10 border border-surface/15 rounded-md px-2 h-8 text-xs font-mono text-muted/70 focus:outline-none focus:border-accent/40" />
              </div>
            </div>
          )}

          {/* Crop watermark */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-muted/80">Crop Watermark</p>
              <RefToggle value={cfg.crop} onChange={(v) => setCfg({ crop: v })} />
            </div>
            {cfg.crop && (
              <p className="text-xs text-cyan-400/60 leading-relaxed">
                With this option, the final picture is slightly zoomed in. Regions near the borders of the screen will be cut off.
              </p>
            )}
          </div>

          {/* Keep aspect ratio */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-muted/80">Keep Aspect Ratio</p>
              <RefToggle value={cfg.keepAspectRatio} onChange={(v) => setCfg({ keepAspectRatio: v })} />
            </div>
            {cfg.keepAspectRatio && cfg.screenWidth === 0 && (
              <p className="text-xs text-amber/70">
                Screen not detected —{' '}
                <button onClick={() => setCfg({ screenWidth: window.screen.width, screenHeight: window.screen.height })}
                  className="underline hover:text-amber transition-colors">detect</button>
              </p>
            )}
          </div>

          {/* Screenshot button */}
          <button
            onClick={take}
            disabled={!connected || taking}
            className={[
              'w-full py-3 rounded-md font-semibold text-sm transition-colors',
              connected && !taking
                ? 'bg-warn text-white hover:bg-warn/80'
                : 'opacity-40 cursor-not-allowed bg-surface/10 text-muted/50',
            ].join(' ')}
          >
            {taking ? 'Capturing…' : 'Screenshot'}
          </button>

          {cfg.hotkey && (
            <p className="text-xs font-mono text-muted/25 text-center -mt-2">{cfg.hotkey}</p>
          )}

          {error && (
            <div className="flex items-start gap-1.5">
              <p className="text-xs font-mono text-warn/70 flex-1 leading-relaxed">{error}</p>
              <button onClick={() => setError(null)} className="text-muted/30 hover:text-muted/60 shrink-0 mt-0.5"><X size={11} /></button>
            </div>
          )}

          <p className="text-xs text-muted/30 leading-relaxed">
            Disable "Render Scene Using 3 Projections" in iRacing (Display {'>'} Monitor tab) to avoid vertical bands in screenshots.
          </p>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-surface/10 p-3 flex items-center gap-2">
          <button onClick={() => setShowSettings(true)}
            className="w-8 h-8 rounded-md flex items-center justify-center text-muted/40 hover:text-muted/80 hover:bg-surface/10 transition-colors">
            <Settings size={15} />
          </button>
        </div>
      </div>

      {/* ── Preview + gallery ────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
          {/* Preview */}
          <div className="flex-1 bg-black/30 flex items-center justify-center overflow-hidden relative">
            {preview || selected?.thumb ? (
              <>
                <img
                  src={preview ?? selected?.thumb ?? ''}
                  alt="preview"
                  className="max-w-full max-h-full object-contain"
                />
                {selected && (
                  <div className="absolute top-3 right-3 flex items-center gap-2">
                    <button
                      onClick={() => window.api.openScreenshotExternal(selected.path)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-black/60 hover:bg-black/80 text-xs font-mono text-white/70 hover:text-white transition-colors"
                    >
                      <ExternalLink size={11} />
                      Open
                    </button>
                    <button
                      onClick={() => window.api.openScreenshot(selected.path)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-black/60 hover:bg-black/80 text-xs font-mono text-white/70 hover:text-white transition-colors"
                    >
                      <FolderOpen size={11} />
                      Show in folder
                    </button>
                  </div>
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
          <div className="h-32 shrink-0 border-t border-surface/10 flex items-center gap-2 px-3 overflow-x-scroll [&::-webkit-scrollbar]:h-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-surface/30 [&::-webkit-scrollbar-track]:bg-transparent"
            onWheel={(e) => { e.currentTarget.scrollLeft += e.deltaY }}>
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
                  <img src={entry.thumb ?? ''} alt={entry.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-surface/10 flex items-center justify-center">
                    <Camera size={14} className="text-muted/20" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

      {/* ── Settings modal ────────────────────────────────────────────────── */}
      {showSettings && (
        <SettingsModal cfg={cfg} setCfg={setCfg} onClose={() => setShowSettings(false)} pickFolder={pickFolder} />
      )}
    </div>
  )
})

// ─── Toggle (reference style) ─────────────────────────────────────────────────

function RefToggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!value)}
      className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${value ? 'bg-warn/80' : 'bg-surface/20'}`}>
      <span className={`absolute top-1 w-4 h-4 rounded-full transition-all ${value ? 'left-6 bg-white' : 'left-1 bg-muted/40'}`} />
    </button>
  )
}

// ─── Settings modal ───────────────────────────────────────────────────────────

import type { ScreenshotConfig } from '@/store/toolStore'

function SettingsModal({ cfg, setCfg, onClose, pickFolder }: {
  cfg: ScreenshotConfig
  setCfg: (c: Partial<ScreenshotConfig>) => void
  onClose: () => void
  pickFolder: () => void
}) {
  const [fmtOpen, setFmtOpen] = useState(false)
  const fmtRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  useEffect(() => {
    if (!fmtOpen) return
    const h = (e: MouseEvent) => { if (!fmtRef.current?.contains(e.target as Node)) setFmtOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [fmtOpen])

  const FORMAT_OPTIONS = [
    { key: 'jpeg', label: 'JPEG (quality 95%)' },
    { key: 'png',  label: 'PNG (lossless)' },
    { key: 'webp', label: 'WebP (quality 95%)' },
  ]

  const TOKEN_GROUPS = [
    { label: 'Track',   tokens: ['{track}', '{trackFull}', '{trackCity}', '{trackCountry}', '{trackType}'] },
    { label: 'Driver',  tokens: ['{driver}', '{driverAbbrev}', '{team}', '{carNumber}', '{car}', '{carFull}', '{carClass}', '{iRating}'] },
    { label: 'Session', tokens: ['{sessionType}', '{lap}'] },
    { label: 'Meta',    tokens: ['{date}', '{time}', '{datetime}', '{counter}'] },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="relative w-full max-w-2xl mx-4 rounded-lg bg-surface/8 backdrop-blur-xl border border-surface/12 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface/10 shrink-0">
          <span className="text-sm font-semibold text-muted/80">Screenshot Settings</span>
          <button onClick={onClose} className="w-7 h-7 rounded-md flex items-center justify-center text-muted/30 hover:text-muted/70 hover:bg-surface/10 transition-colors">
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1">
          <div className="p-6 space-y-5">

            {/* Screenshot Folder */}
            <SettingsRow label="Screenshot Folder">
              <div className="flex gap-2">
                <input readOnly value={cfg.folder}
                  className="flex-1 min-w-0 bg-surface/10 border border-surface/15 rounded-md px-3 h-9 text-xs font-mono text-muted/50 cursor-default" />
                <button onClick={pickFolder}
                  className="px-4 h-9 rounded-md bg-warn text-white text-xs font-semibold hover:bg-warn/80 transition-colors shrink-0">
                  Select Folder
                </button>
              </div>
            </SettingsRow>

            {/* Hotkey */}
            <SettingsRow label="Screenshot Keybind">
              <div className="flex gap-2">
                <input value={cfg.hotkey} onChange={(e) => setCfg({ hotkey: e.target.value })}
                  placeholder="Control+PrintScreen"
                  className="flex-1 bg-surface/10 border border-surface/15 rounded-md px-3 h-9 text-xs font-mono text-muted/70 focus:outline-none focus:border-accent/40" />
              </div>
            </SettingsRow>

            {/* Filename format */}
            <SettingsToggleRow
              label="Custom Filename Format"
              desc={`Use a custom pattern instead of the default (${'{track}-{driver}-{counter}'})`}
              value={cfg.useCustomFilename}
              onChange={(v) => setCfg({ useCustomFilename: v })}
            />
            {cfg.useCustomFilename && (
              <div className="space-y-2 pl-4 border-l border-surface/10">
                <p className="text-xs text-muted/40">Click fields to add them to the format. Type separators (-, _ etc.) directly.</p>
                <div className="flex gap-2">
                  <input value={cfg.filenameFormat} onChange={(e) => setCfg({ filenameFormat: e.target.value })}
                    className="flex-1 bg-surface/10 border border-surface/15 rounded-md px-3 h-9 text-xs font-mono text-muted/70 focus:outline-none focus:border-accent/40" />
                  <button onClick={() => setCfg({ filenameFormat: '{track}-{driver}-{counter}' })}
                    className="px-3 h-9 rounded-md border border-surface/15 text-xs font-mono text-muted/50 hover:text-muted/80 hover:bg-surface/10 transition-colors">
                    Reset
                  </button>
                </div>
                <p className="text-xs font-mono text-muted/40">
                  Preview: <span className="text-muted/70">{cfg.filenameFormat.replace('{track}', 'Daytona').replace('{driver}', 'Driver').replace('{counter}', '0')}.{cfg.outputFormat === 'jpeg' ? 'jpg' : cfg.outputFormat}</span>
                </p>
                {TOKEN_GROUPS.map((g) => (
                  <div key={g.label}>
                    <p className="text-xs font-mono text-muted/30 mb-1">{g.label}</p>
                    <div className="flex flex-wrap gap-1">
                      {g.tokens.map((t) => (
                        <button key={t} onClick={() => setCfg({ filenameFormat: cfg.filenameFormat + t })}
                          className="px-2 py-0.5 rounded text-xs font-mono bg-surface/15 text-muted/50 hover:text-accent hover:bg-accent/10 transition-colors">
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Output format */}
            <SettingsRow label="Output Format">
              <div ref={fmtRef} className="relative">
                <button onClick={() => setFmtOpen((v) => !v)}
                  className="flex items-center justify-between bg-surface/10 border border-surface/15 rounded-md px-3 h-9 text-xs font-mono text-muted/70 hover:border-surface/30 transition-colors w-56">
                  {FORMAT_OPTIONS.find((o) => o.key === cfg.outputFormat)?.label}
                  <ChevronDown size={12} className={`transition-transform ${fmtOpen ? 'rotate-180' : ''}`} />
                </button>
                {fmtOpen && (
                  <div className="absolute top-full left-0 mt-1 w-56 rounded-md bg-app border border-surface/15 shadow-xl overflow-hidden z-50">
                    {FORMAT_OPTIONS.map(({ key, label }) => (
                      <button key={key} onClick={() => { setCfg({ outputFormat: key as 'jpeg' | 'png' | 'webp' }); setFmtOpen(false) }}
                        className={`w-full text-left px-3 py-2 text-xs font-mono transition-colors ${cfg.outputFormat === key ? 'text-accent bg-accent/10' : 'text-muted/50 hover:bg-surface/10'}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </SettingsRow>

            {/* Prefer top-left crop */}
            <SettingsToggleRow
              label="Prefer top-left watermark crop"
              desc="Crops only the bottom-right corner (3% expansion). When off, the screenshot is expanded by 6% and cropped equally from all sides."
              value={cfg.cropTopLeft}
              onChange={(v) => setCfg({ cropTopLeft: v })}
            />

            {/* Manual window restore */}
            <SettingsToggleRow
              label="Manual Window Restore"
              desc="Override the automatic window restore with custom position and size. Useful for Ultrawide or Nvidia Surround."
              value={cfg.manualRestore}
              onChange={(v) => setCfg({ manualRestore: v })}
            />

            {cfg.manualRestore && (
              <div className="space-y-3 pl-4 border-l border-surface/10">
                <div className="grid grid-cols-2 gap-3">
                  {(['manualRestoreX', 'manualRestoreY', 'manualRestoreWidth', 'manualRestoreHeight'] as const).map((key) => (
                    <div key={key}>
                      <p className="text-xs font-mono text-muted/40 mb-1 capitalize">{key.replace('manualRestore', '')}</p>
                      <input type="number" value={(cfg as Record<string, unknown>)[key] as number}
                        onChange={(e) => setCfg({ [key]: Number(e.target.value) } as Partial<ScreenshotConfig>)}
                        className="w-full bg-surface/10 border border-surface/15 rounded-md px-3 h-9 text-xs font-mono text-muted/70 focus:outline-none focus:border-accent/40" />
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => window.api.restoreIracingWindow({
                    x: cfg.manualRestoreX, y: cfg.manualRestoreY,
                    width: cfg.manualRestoreWidth, height: cfg.manualRestoreHeight,
                  })}
                  className="w-full py-2.5 rounded-md bg-accent/20 border border-accent/30 text-accent text-xs font-mono font-semibold hover:bg-accent/30 transition-colors"
                >
                  Restore Now
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-3 border-t border-surface/10 flex justify-end shrink-0">
          <span className="text-xs font-mono text-muted/20">ESC to close</span>
        </div>
      </div>
    </div>
  )
}

function SettingsRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-semibold text-muted/70">{label}</p>
      {children}
    </div>
  )
}

function SettingsToggleRow({ label, desc, value, onChange }: {
  label: string; desc: string; value: boolean; onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1">
        <p className="text-sm font-semibold text-muted/70">{label}</p>
        <p className="text-xs text-muted/35 mt-0.5 leading-relaxed">{desc}</p>
      </div>
      <RefToggle value={value} onChange={onChange} />
    </div>
  )
}
