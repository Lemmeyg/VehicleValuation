/**
 * URL Validator for Comparable Listings
 *
 * Validates that listing VDP URLs point to live, active vehicle pages.
 * Run server-side during report creation after MarketCheck data is fetched.
 *
 * Strategy: AGGRESSIVE REJECTION
 * - Any URL that cannot be positively confirmed as valid is rejected.
 * - Only HTTP 200 responses with unchanged URL paths and no sold-keywords are kept.
 * - Timeouts, 403s, 404s, bot-blocks, and homepage redirects are all rejected.
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
const MAX_CANDIDATES = 30
const BODY_SCAN_BYTES = 3072 // 3KB — enough to catch page title and above-fold content

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
 * Validate listing URLs in a MarketCheckPrediction.
 *
 * - Sorts all listings by dos_active (ascending) and takes the top 30 as candidates.
 * - Validates all candidates in parallel (wall-clock time ≈ 4s).
 * - Adds url_validated: boolean to every listing.
 * - Listings outside the top 30 candidate pool get url_validated: false.
 * - Listings with no vdp_url get url_validated: true (data is valid, just no link).
 *
 * @returns A new MarketCheckPrediction with url_validated stamped on each listing.
 */
export async function validateListingUrls(
  prediction: MarketCheckPrediction
): Promise<MarketCheckPrediction> {
  if (!prediction.recentComparables?.listings?.length) {
    return prediction
  }

  const allListings = prediction.recentComparables.listings

  // Select top 30 candidates by dos_active ascending (same ordering as the display layer).
  // Listings without dos_active get Infinity, sinking them to the bottom of the sort.
  // This is intentional: the display layer (getLowestDOSActiveListings) also excludes
  // listings with undefined dos_active, so they would never appear in the report
  // regardless of their url_validated value. Placing them outside the candidate pool
  // avoids wasting validation budget on listings that can't be displayed.
  const sortedIndices = allListings
    .map((l, i) => ({ i, dos: l.dos_active ?? Infinity }))
    .sort((a, b) => a.dos - b.dos)
    .slice(0, MAX_CANDIDATES)
    .map(({ i }) => i)

  const candidateIndexSet = new Set(sortedIndices)

  // Validate all candidates in parallel
  const validationResults = await Promise.allSettled(
    sortedIndices.map(async idx => {
      const listing = allListings[idx]
      // No vdp_url → mark as valid: the listing's price/mileage data is still
      // legitimate market evidence; the display layer handles the no-link case.
      const valid = listing.vdp_url ? await checkUrl(listing.vdp_url) : true
      return { idx, valid }
    })
  )

  // Build index → valid map
  const validMap = new Map<number, boolean>()
  for (const result of validationResults) {
    if (result.status === 'fulfilled') {
      validMap.set(result.value.idx, result.value.valid)
    }
  }

  // Annotate every listing with url_validated
  const validatedListings = allListings.map((listing, idx) => ({
    ...listing,
    url_validated: candidateIndexSet.has(idx) ? (validMap.get(idx) ?? false) : false,
  }))

  return {
    ...prediction,
    recentComparables: {
      ...prediction.recentComparables,
      listings: validatedListings,
    },
  }
}
