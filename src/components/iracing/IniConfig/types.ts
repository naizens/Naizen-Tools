export interface IniProfile {
  id: string
  name: string
  slug: string
  files: string[]
  savedAt: number
}

export function sourceName(target: string, slug: string): string {
  const dot  = target.lastIndexOf('.')
  const stem = dot >= 0 ? target.slice(0, dot) : target
  const ext  = dot >= 0 ? target.slice(dot) : ''
  return `${stem}_${slug}${ext}`
}

export function fmtDate(ts: number): string {
  return new Date(ts).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function computeMatches(text: string, q: string): number[] {
  if (!q) return []
  const out: number[] = []
  const hay = text.toLowerCase(), needle = q.toLowerCase()
  let i = hay.indexOf(needle)
  while (i !== -1) { out.push(i); i = hay.indexOf(needle, i + Math.max(1, needle.length)) }
  return out
}
