const KEY = 'kb_last_touch'

export interface KBAttribution {
  slug: string
  title: string
  visited_at: string
}

export function setKBAttribution(slug: string, title: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(KEY, JSON.stringify({ slug, title, visited_at: new Date().toISOString() }))
}

export function getKBAttribution(): KBAttribution | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as KBAttribution) : null
  } catch {
    return null
  }
}
