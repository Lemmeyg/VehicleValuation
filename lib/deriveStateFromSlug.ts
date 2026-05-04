const STATE_SLUG_SUFFIX = '-total-loss-law-explained'
const STOP_WORDS = new Set(['of', 'the', 'and', 'at', 'in', 'on'])

export function deriveStateFromSlug(slug: string): string | null {
  if (!slug.endsWith(STATE_SLUG_SUFFIX)) return null
  const statePart = slug.slice(0, -STATE_SLUG_SUFFIX.length)
  return statePart
    .split('-')
    .map((word, i) =>
      i === 0 || !STOP_WORDS.has(word) ? word.charAt(0).toUpperCase() + word.slice(1) : word
    )
    .join(' ')
}
