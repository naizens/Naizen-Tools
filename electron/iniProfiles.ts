import { app } from 'electron'
import { join, extname } from 'path'
import { randomUUID } from 'crypto'
import {
  copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync,
} from 'fs'

// Each profile owns its own source files in the iRacing folder, named
// deterministically: <stem>_<slug>.<ext> for each managed target file.
// The slug is unique per profile, so two profiles can never share a source
// file and the target↔source mapping can never be crossed.
//   app.ini               ↔ app_<slug>.ini
//   rendererDX11Monitor.ini ↔ rendererDX11Monitor_<slug>.ini

export interface IniProfile {
  id: string
  name: string
  slug: string
  files: string[]   // managed target files captured by this profile
  savedAt: number
}

interface ProfileIndex { profiles: IniProfile[] }

function baseDir(): string {
  const dir = join(app.getPath('userData'), 'ini-profiles')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}
function indexPath(): string { return join(baseDir(), 'index.json') }

function loadIndex(): ProfileIndex {
  try {
    const idx = JSON.parse(readFileSync(indexPath(), 'utf-8')) as ProfileIndex
    idx.profiles = idx.profiles ?? []
    return idx
  } catch {
    return { profiles: [] }
  }
}
function saveIndex(idx: ProfileIndex) {
  writeFileSync(indexPath(), JSON.stringify(idx, null, 2))
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '')
}
function uniqueSlug(name: string, profiles: { slug?: string }[]): string {
  const base = slugify(name) || 'profile'
  const taken = new Set(profiles.map((p) => p.slug).filter(Boolean))
  let slug = base, n = 2
  while (taken.has(slug)) slug = `${base}${n++}`
  return slug
}
// app.ini + "triple1440p" -> app_triple1440p.ini
function sourceNameFor(target: string, slug: string): string {
  const ext = extname(target)
  const stem = ext ? target.slice(0, -ext.length) : target
  return `${stem}_${slug}${ext}`
}

// ─── Folder / file helpers ─────────────────────────────────────────────────

export function detectIracingFolder(): string {
  return join(app.getPath('documents'), 'iRacing')
}

export function listConfigFiles(folder: string): string[] {
  try {
    return readdirSync(folder)
      .filter((f) => f.toLowerCase().endsWith('.ini'))
      .filter((f) => statSync(join(folder, f)).isFile())
      .sort((a, b) => a.localeCompare(b))
  } catch { return [] }
}

export function fileMtimes(folder: string): Record<string, number> {
  const out: Record<string, number> = {}
  try {
    for (const f of readdirSync(folder)) {
      if (!f.toLowerCase().endsWith('.ini')) continue
      try { out[f] = statSync(join(folder, f)).mtimeMs } catch { /* skip */ }
    }
  } catch { /* folder missing */ }
  return out
}

function isPlainName(file: string): boolean {
  return !file.includes('/') && !file.includes('\\') && !file.includes('..')
}
export function readConfigFile(folder: string, file: string): string {
  if (!isPlainName(file)) return ''
  try { return readFileSync(join(folder, file), 'utf-8') } catch { return '' }
}
export function writeConfigFile(folder: string, file: string, content: string): boolean {
  if (!isPlainName(file) || !file.toLowerCase().endsWith('.ini')) return false
  // iRacing config files use CRLF — keep editor saves consistent.
  const crlf = content.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n')
  try { writeFileSync(join(folder, file), crlf, 'utf-8'); return true } catch { return false }
}
export function deleteConfigFile(folder: string, file: string): boolean {
  if (!isPlainName(file) || !file.toLowerCase().endsWith('.ini')) return false
  try { rmSync(join(folder, file), { force: true }); return true } catch { return false }
}

// ─── Migration from the old (buggy) free-mapping format ───────────────────────
// Old profiles stored `sources: Record<target, arbitraryFile>` which could be
// crossed or shared. Convert each to the deterministic slug model. For each
// target we pick the old source whose name best matches the target stem, so a
// crossed app↔renderer mapping gets un-crossed.

function bestOldSourceForTarget(target: string, oldSources: string[]): string | null {
  const norm = (s: string) => s.toLowerCase().replace(/\.ini$/i, '').replace(/[^a-z0-9]/g, '')
  const tStem = norm(target)
  let best: string | null = null, bestScore = -1
  for (const s of oldSources) {
    const sNorm = norm(s)
    let score: number
    if (sNorm.startsWith(tStem)) score = tStem.length + 100
    else { let i = 0; while (i < tStem.length && i < sNorm.length && tStem[i] === sNorm[i]) i++; score = i }
    if (score > bestScore) { bestScore = score; best = s }
  }
  return best
}

export function migrateProfiles(folder: string) {
  const idx = loadIndex()
  let changed = false
  for (const p of idx.profiles as (IniProfile & { sources?: Record<string, string> })[]) {
    if (p.slug) continue                                  // already new format
    const oldSources = p.sources ? Object.values(p.sources) : []
    const files = p.sources ? Object.keys(p.sources) : []
    const slug = uniqueSlug(p.name, idx.profiles)
    for (const target of files) {
      const match = bestOldSourceForTarget(target, oldSources)
      const dest = sourceNameFor(target, slug)
      if (match && match !== dest && existsSync(join(folder, match))) {
        try { copyFileSync(join(folder, match), join(folder, dest)) } catch { /* skip */ }
      }
    }
    p.slug = slug
    p.files = files
    delete p.sources
    changed = true
  }
  if (changed) saveIndex(idx)
}

// ─── Profiles ───────────────────────────────────────────────────────────────

export function listProfiles(): IniProfile[] {
  return loadIndex().profiles.filter((p) => p.slug).sort((a, b) => b.savedAt - a.savedAt)
}

// Snapshot the current live targets into the profile's own deterministic sources.
export function createProfile(opts: { name: string; folder: string; managedFiles: string[] }): IniProfile {
  const idx = loadIndex()
  const slug = uniqueSlug(opts.name, idx.profiles)
  const files: string[] = []
  for (const target of opts.managedFiles) {
    const tgt = join(opts.folder, target)
    if (existsSync(tgt)) {
      try { copyFileSync(tgt, join(opts.folder, sourceNameFor(target, slug))); files.push(target) } catch { /* skip */ }
    }
  }
  const profile: IniProfile = { id: randomUUID(), name: opts.name, slug, files, savedAt: Date.now() }
  idx.profiles.push(profile)
  saveIndex(idx)
  return profile
}

// Apply = copy each profile source into its live target.
export function applyProfile(id: string, folder: string): { applied: string[]; failed: string[] } {
  const p = loadIndex().profiles.find((x) => x.id === id)
  if (!p) throw new Error('Profile not found')
  const applied: string[] = [], failed: string[] = []
  for (const target of p.files) {
    try { copyFileSync(join(folder, sourceNameFor(target, p.slug)), join(folder, target)); applied.push(target) }
    catch { failed.push(target) }
  }
  return { applied, failed }
}

// Update = capture the current live targets back into the profile's sources.
export function updateProfile(id: string, folder: string, managedFiles: string[]): { updated: string[] } {
  const idx = loadIndex()
  const p = idx.profiles.find((x) => x.id === id)
  if (!p) return { updated: [] }
  const files: string[] = []
  for (const target of managedFiles) {
    const tgt = join(folder, target)
    if (existsSync(tgt)) {
      try { copyFileSync(tgt, join(folder, sourceNameFor(target, p.slug))); files.push(target) } catch { /* skip */ }
    }
  }
  p.files = files
  p.savedAt = Date.now()
  saveIndex(idx)
  return { updated: files }
}

// Which targets differ from their profile source (line-ending insensitive).
export function compareProfile(id: string, folder: string): { changed: string[] } {
  const p = loadIndex().profiles.find((x) => x.id === id)
  if (!p) return { changed: [] }
  const norm = (s: string) => s.replace(/\r\n/g, '\n')
  const changed: string[] = []
  for (const target of p.files) {
    try {
      const live = norm(readFileSync(join(folder, target), 'utf-8'))
      const src  = norm(readFileSync(join(folder, sourceNameFor(target, p.slug)), 'utf-8'))
      if (live !== src) changed.push(target)
    } catch {
      changed.push(target)
    }
  }
  return { changed }
}

// Source filenames a profile manages (for display).
export function profileSources(p: IniProfile): Record<string, string> {
  const out: Record<string, string> = {}
  for (const target of p.files) out[target] = sourceNameFor(target, p.slug)
  return out
}

export function deleteProfile(id: string) {
  const idx = loadIndex()
  idx.profiles = idx.profiles.filter((p) => p.id !== id)
  saveIndex(idx)
}

export function renameProfile(id: string, name: string) {
  const idx = loadIndex()
  const p = idx.profiles.find((x) => x.id === id)
  if (p) { p.name = name; saveIndex(idx) }   // slug stays fixed → source files stay valid
}
