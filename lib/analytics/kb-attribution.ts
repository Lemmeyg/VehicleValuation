const KEY = 'kb_last_touch'

export interface KBAttribution {
  slug: string
  title: string
  visited_at: string
}

export function setKBAttribution(slug: string, title: string): void {
  if (typeof window === 'undefined') return
  // Touching window.sessionStorage throws DOMException/SecurityError outright when
  // the browser denies storage access (blocked cookies, some embedded contexts) —
  // "Access is denied for this document", seen in production on a KB article.
  // This runs from ArticlePageTracker's mount effect on every KB article view, so
  // an unguarded throw takes the article page down. Attribution is best-effort:
  // losing it must never break the page. getKBAttribution already guards its read.
  try {
    sessionStorage.setItem(
      KEY,
      JSON.stringify({ slug, title, visited_at: new Date().toISOString() })
    )
  } catch {
    // Storage unavailable — skip attribution rather than propagating.
  }
}

export function getKBAttribution(): KBAttribution | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as KBAttribution) : null
  } catch {
    return null
  }
}
