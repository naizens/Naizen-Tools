import { app, desktopCapturer, screen } from 'electron'
import { spawnSync } from 'child_process'
import { existsSync, mkdirSync } from 'fs'
import { join, extname } from 'path'
import sharp from 'sharp'
import type { IracingSessionInfo } from './iracing'

// ─── Resolution presets ───────────────────────────────────────────────────────

export const RESOLUTIONS: Record<string, { width: number; height: number }> = {
  '1080p': { width: 1920,  height: 1080 },
  '2k':    { width: 2560,  height: 1440 },
  '4k':    { width: 3840,  height: 2160 },
  '5k':    { width: 5120,  height: 2880 },
  '6k':    { width: 6400,  height: 3600 },
  '7k':    { width: 7168,  height: 4032 },
  '8k':    { width: 7680,  height: 4320 },
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ScreenshotConfig {
  resolution: string
  customWidth: number
  customHeight: number
  crop: boolean
  keepAspectRatio: boolean
  outputFormat: 'jpeg' | 'png' | 'webp'
  folder: string
  filenameFormat: string
  screenWidth: number
  screenHeight: number
}

export interface WindowBounds {
  x: number
  y: number
  width: number
  height: number
  handle: number
}

// ─── Window utils (PowerShell) ────────────────────────────────────────────────

export function getIracingWindow(): WindowBounds | null {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { windowManager } = require('node-window-manager')
  const windows: any[] = windowManager.getWindows()
  const iracingTitles = ['iracing.com simulator', 'iracing simulator', 'iracing']
  const win = windows.find((w: any) => {
    const title = (w.getTitle?.() ?? '').toLowerCase()
    return iracingTitles.some((t) => title.includes(t))
  })
  if (!win) return null
  const bounds = win.getBounds?.()
  const handle = win.id ?? win.handle ?? 0
  return bounds ? { ...bounds, handle } : null
}

export function resizeWindow(bounds: WindowBounds, width: number, height: number) {
  const ps = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class WinAPI {
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool BringWindowToTop(IntPtr hWnd);
}
"@
$hwnd = [IntPtr]${bounds.handle}
[WinAPI]::ShowWindow($hwnd, 9)
[WinAPI]::SetWindowPos($hwnd, [IntPtr](-2), ${bounds.x}, ${bounds.y}, ${width}, ${height}, 0)
[WinAPI]::BringWindowToTop($hwnd)
[WinAPI]::SetForegroundWindow($hwnd)
`
  spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', ps], { timeout: 5000 })
}

export function restoreWindow(bounds: WindowBounds) {
  resizeWindow(bounds, bounds.width, bounds.height)
}

// ─── Desktop capturer source resolution ──────────────────────────────────────

export async function getDesktopSource(bounds: WindowBounds): Promise<string | null> {
  const sources = await desktopCapturer.getSources({
    types: ['window', 'screen'],
    thumbnailSize: { width: 0, height: 0 },
  })

  // 1. Window handle match (most reliable)
  const handleId = `window:${bounds.handle}:0`
  const byHandle = sources.find((s) => s.id === handleId)
  if (byHandle) return byHandle.id

  // 2. Window title match
  const iracingTitles = ['iracing.com simulator', 'iracing simulator', 'iracing']
  const byTitle = sources.find((s) =>
    iracingTitles.some((t) => s.name.toLowerCase().includes(t))
  )
  if (byTitle) return byTitle.id

  // 3. Display match (fallback to screen containing the window)
  const display = screen.getDisplayMatching({ x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height })
  const screenSources = sources.filter((s) => s.id.startsWith('screen:'))
  if (screenSources.length > 0) {
    // Try matching by display index
    const allDisplays = screen.getAllDisplays()
    const idx = allDisplays.findIndex((d) => d.id === display.id)
    const screenSource = screenSources[idx] ?? screenSources[0]
    return screenSource?.id ?? null
  }

  return null
}

// ─── Filename token resolution ────────────────────────────────────────────────

function transliterate(str: string): string {
  return str.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w\s\-]/g, '')
}

function sanitize(str: string): string {
  return transliterate(str).replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '_').trim()
}

function resolveTokens(format: string, session: IracingSessionInfo, lap: number, sessionNum: number): string {
  const wi = session.WeekendInfo ?? {}
  const di = session.DriverInfo ?? {}
  const drivers = di.Drivers ?? []
  const driverCarIdx = di.DriverCarIdx ?? 0
  const driver = drivers.find((d) => d.CarIdx === driverCarIdx) ?? drivers[0]
  const sessions = session.SessionInfo?.Sessions ?? []
  const currentSession = sessions[sessionNum] ?? sessions[0]

  const tokens: Record<string, string> = {
    track:        sanitize(wi.TrackDisplayShortName ?? wi.TrackName ?? 'track'),
    trackFull:    sanitize(wi.TrackDisplayName ?? wi.TrackName ?? 'track'),
    trackCity:    sanitize(wi.TrackCity ?? ''),
    trackCountry: sanitize(wi.TrackCountry ?? ''),
    trackType:    sanitize(wi.TrackType ?? ''),
    driver:       sanitize(driver?.UserName ?? driver?.TeamName ?? 'driver'),
    driverAbbrev: sanitize(driver?.AbbrevName ?? ''),
    team:         sanitize(driver?.TeamName ?? ''),
    carNumber:    sanitize(driver?.CarNumber ?? ''),
    car:          sanitize(driver?.CarScreenNameShort ?? ''),
    carFull:      sanitize(driver?.CarScreenName ?? ''),
    carClass:     sanitize(driver?.CarClassShortName ?? driver?.CarClass ?? ''),
    iRating:      String(driver?.IRating ?? 0),
    sessionType:  sanitize(currentSession?.SessionType ?? ''),
    lap:          String(lap),
    date:         new Date().toISOString().slice(0, 10),
    time:         new Date().toTimeString().slice(0, 8).replace(/:/g, '-'),
    datetime:     new Date().toISOString().slice(0, 19).replace(/T/, '_').replace(/:/g, '-'),
  }

  return format.replace(/\{(\w+)\}/g, (_, key) => tokens[key] ?? key)
}

export function resolveFilename(
  format: string,
  session: IracingSessionInfo,
  lap: number,
  sessionNum: number,
  folder: string,
  ext: string,
): string {
  const base = resolveTokens(format, session, lap, sessionNum)
  if (!existsSync(folder)) mkdirSync(folder, { recursive: true })

  let counter = 0
  let candidate = join(folder, `${base}-${counter}${ext}`)
  while (existsSync(candidate)) {
    counter++
    candidate = join(folder, `${base}-${counter}${ext}`)
  }
  return candidate
}

// ─── Sharp processing ─────────────────────────────────────────────────────────

export async function processImage(
  buffer: Buffer,
  targetWidth: number,
  targetHeight: number,
  crop: boolean,
  cropTopLeft: boolean,
  outputPath: string,
): Promise<void> {
  sharp.cache(false)
  const image = sharp(buffer)
  const meta = await image.metadata()
  const srcW = meta.width ?? targetWidth
  const srcH = meta.height ?? targetHeight

  if (crop) {
    const x = cropTopLeft ? 0 : Math.round((srcW - targetWidth) / 2)
    const y = cropTopLeft ? 0 : Math.round((srcH - targetHeight) / 2)
    const w = Math.min(targetWidth, srcW - x)
    const h = Math.min(targetHeight, srcH - y)
    await image.extract({ left: x, top: y, width: w, height: h }).toFile(outputPath)
  } else {
    await image.toFile(outputPath)
  }
}

// ─── Thumbnail generation ──────────────────────────────────────────────────────

export async function makeThumbnail(sourcePath: string): Promise<string> {
  const cacheDir = join(app.getPath('userData'), 'ScreenshotCache')
  if (!existsSync(cacheDir)) mkdirSync(cacheDir, { recursive: true })

  const name = sourcePath.split(/[\\/]/).pop()!.replace(extname(sourcePath), '.webp')
  const thumbPath = join(cacheDir, name)

  sharp.cache(false)
  await sharp(sourcePath)
    .resize(1280, 720, { fit: 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: 80 })
    .toFile(thumbPath)

  return thumbPath
}

// ─── Capture dimensions ───────────────────────────────────────────────────────

export function getCaptureDimensions(config: ScreenshotConfig): {
  targetWidth: number
  targetHeight: number
  captureWidth: number
  captureHeight: number
} {
  let targetWidth: number
  let targetHeight: number

  if (config.resolution === 'custom') {
    targetWidth = config.customWidth
    targetHeight = config.customHeight
  } else {
    const preset = RESOLUTIONS[config.resolution] ?? RESOLUTIONS['1080p']
    targetWidth = preset.width
    targetHeight = preset.height
  }

  if (config.keepAspectRatio && config.screenWidth > 0 && config.screenHeight > 0) {
    targetHeight = Math.round((targetWidth * config.screenHeight) / config.screenWidth)
  }

  // 6% expansion for crop margin (removes UI watermark)
  const expansion = config.crop ? 1.06 : 1
  const captureWidth = Math.round(targetWidth * expansion)
  const captureHeight = Math.round(targetHeight * expansion)

  return { targetWidth, targetHeight, captureWidth, captureHeight }
}

export const EXT: Record<string, string> = {
  jpeg: '.jpg',
  png:  '.png',
  webp: '.webp',
}
