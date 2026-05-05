const STATE_SLUG_SUFFIX = '-total-loss-law-explained'

export function deriveStateFromSlug(slug: string): string | null {
  if (!slug.endsWith(STATE_SLUG_SUFFIX)) return null
  const statePart = slug.slice(0, -STATE_SLUG_SUFFIX.length)
  return statePart
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}
