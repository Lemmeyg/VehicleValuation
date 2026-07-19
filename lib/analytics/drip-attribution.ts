const KEY = 'drip_last_touch'

export interface DripAttribution {
  utm_source: string
  utm_medium: string
  utm_content: string
  captured_at: string
}

export function setDripAttribution(utmSource: string, utmMedium: string, utmContent: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(
    KEY,
    JSON.stringify({
      utm_source: utmSource,
      utm_medium: utmMedium,
      utm_content: utmContent,
      captured_at: new Date().toISOString(),
    })
  )
}

export function getDripAttribution(): DripAttribution | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as DripAttribution) : null
  } catch {
    return null
  }
}
