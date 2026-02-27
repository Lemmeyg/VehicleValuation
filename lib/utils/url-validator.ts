/**
 * URL Validator for Comparable Listings
 *
 * Validates that listing VDP URLs point to live, active vehicle pages.
 * Run server-side during report creation after MarketCheck data is fetched.
 *
 * Strategy: AGGRESSIVE REJECTION + SEQUENTIAL BATCHING
 * - Any URL that cannot be positively confirmed as valid is rejected.
 * - Only HTTP 200 responses with unchanged URL paths and no sold-keywords are kept.
 * - Timeouts, 403s, 404s, bot-blocks, and homepage redirects are all rejected.
 * - Validates in batches of 20 (sorted by dos_active) and stops as soon as
 *   TARGET_VALID (10) passing listings are found. Subsequent batches are only
 *   fetched if the previous batch did not supply enough passing URLs.
 *
 * Rationale: MarketCheck returns 40–80+ listings so there is always sufficient
 * pool depth. Quality of displayed listings > quantity.
 */

import type { MarketCheckPrediction } from '@/lib/api/marketcheck-client'

const SOLD_KEYWORDS = [
  'no longer available',
  'vehicle has been sold',
  'this listing has expired',
  'vehicle not found',
  'sorry, this page',
  'in the shop',
  'currently unavailable',
  'page not found',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'

const VALIDATION_TIMEOUT_MS = 4000
const BATCH_SIZE = 20
const TARGET_VALID = 10
const BODY_SCAN_BYTES = 3072 // 3KB — enough to catch page title and above-fold content

export interface ValidationStats {
  /** Total number of URLs actually fetched (excludes no-vdp_url listings) */
  checkedCount: number
  /** Number of URLs that failed validation */
  failedCount: number
  /** The specific URLs that failed */
  failedUrls: string[]
  /** How many batches of 20 were needed to reach TARGET_VALID */
  batchesUsed: number
}

/**
 * Read only the first BODY_SCAN_BYTES of a response body using streaming.
 * Falls back to response.text() in environments where response.body is unavailable
 * (e.g. Jest mocks), which is safe because those mocks return tiny strings.
 */
async function readBodySnippet(response: Response): Promise<string> {
  if (!response.body) {
    // Test environment: mock responses lack a ReadableStream body
    const text = await response.text()
    return text.slice(0, BODY_SCAN_BYTES).toLowerCase()
  }
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let totalRead = 0
  try {
    while (totalRead < BODY_SCAN_BYTES) {
      const { done, value } = await reader.read()
      if (done || !value) break
      chunks.push(value)
      totalRead += value.byteLength
    }
  } finally {
    await reader.cancel()
  }
  const buffer = new Uint8Array(totalRead)
  let offset = 0
  for (const chunk of chunks) {
    buffer.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new TextDecoder().decode(buffer).slice(0, BODY_SCAN_BYTES).toLowerCase()
}

/**
 * Check a single URL. Returns true only if the URL is positively confirmed valid.
 */
async function checkUrl(url: string): Promise<boolean> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), VALIDATION_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    })

    // Must be HTTP 200
    if (response.status !== 200) return false

    // Compare original hostname to final hostname (cross-domain redirect)
    const parsedOriginal = new URL(url)
    const parsedFinal = new URL(response.url)
    if (parsedOriginal.hostname !== parsedFinal.hostname) return false

    // Check final path for homepage redirect
    const finalPath = parsedFinal.pathname
    if (finalPath === '/' || finalPath === '') return false
    const pathSegments = finalPath.split('/').filter(s => s.length > 0)
    if (pathSegments.length < 3) return false

    // Scan first 3KB of body for sold/unavailability keywords (streaming to avoid
    // buffering full page HTML — dealer pages can be 500KB–2MB)
    const snippet = await readBodySnippet(response)
    if (SOLD_KEYWORDS.some(kw => snippet.includes(kw))) return false

    return true
  } catch {
    // Timeout (AbortError), network failure, any exception → reject
    return false
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * Validate listing URLs in a MarketCheckPrediction using sequential batching.
 *
 * - Sorts all listings by dos_active (ascending) and processes them in batches
 *   of BATCH_SIZE (20). Each batch is validated in parallel.
 * - Stops as soon as TARGET_VALID (10) listings with passing URLs are found.
 *   Additional batches are only fetched if the previous batch did not supply enough.
 * - Adds url_validated: boolean to every listing.
 *   - Listings that passed URL validation → url_validated: true
 *   - Listings that failed or were never checked → url_validated: false
 *   - Listings with no vdp_url → url_validated: true (data is valid, just no link)
 *
 * @returns The annotated prediction plus ValidationStats tracking how many
 *          URLs were checked, how many failed, and which URLs failed.
 */
export async function validateListingUrls(
  prediction: MarketCheckPrediction
): Promise<{ prediction: MarketCheckPrediction; stats: ValidationStats }> {
  const emptyStats: ValidationStats = {
    checkedCount: 0,
    failedCount: 0,
    failedUrls: [],
    batchesUsed: 0,
  }

  if (!prediction.recentComparables?.listings?.length) {
    return { prediction, stats: emptyStats }
  }

  const allListings = prediction.recentComparables.listings

  // Sort all listings by dos_active ascending (same ordering as the display layer).
  // Listings without dos_active get Infinity, sinking them to the bottom of the sort.
  const sortedIndices = allListings
    .map((l, i) => ({ i, dos: l.dos_active ?? Infinity }))
    .sort((a, b) => a.dos - b.dos)
    .map(({ i }) => i)

  const validIndexSet = new Set<number>()
  const stats: ValidationStats = {
    checkedCount: 0,
    failedCount: 0,
    failedUrls: [],
    batchesUsed: 0,
  }

  // Process batches sequentially; each batch runs its fetches in parallel.
  // Stop as soon as TARGET_VALID passing listings have been found.
  for (
    let offset = 0;
    offset < sortedIndices.length && validIndexSet.size < TARGET_VALID;
    offset += BATCH_SIZE
  ) {
    const batch = sortedIndices.slice(offset, offset + BATCH_SIZE)
    stats.batchesUsed++

    const batchResults = await Promise.allSettled(
      batch.map(async idx => {
        const listing = allListings[idx]
        if (!listing.vdp_url) {
          // No URL: auto-valid, don't count as a URL check
          return { idx, valid: true, url: null }
        }
        const valid = await checkUrl(listing.vdp_url)
        return { idx, valid, url: listing.vdp_url }
      })
    )

    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        const { idx, valid, url } = result.value
        if (url !== null) {
          // Only count listings where we actually fetched a URL
          stats.checkedCount++
          if (!valid) {
            stats.failedCount++
            stats.failedUrls.push(url)
          }
        }
        if (valid) {
          validIndexSet.add(idx)
        }
      }
    }
  }

  // Annotate every listing with url_validated
  const validatedListings = allListings.map((listing, idx) => ({
    ...listing,
    url_validated: validIndexSet.has(idx),
  }))

  return {
    prediction: {
      ...prediction,
      recentComparables: {
        ...prediction.recentComparables,
        listings: validatedListings,
      },
    },
    stats,
  }
}
