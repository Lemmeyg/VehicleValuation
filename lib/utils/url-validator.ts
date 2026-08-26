/**
 * URL Validator for Comparable Listings
 *
 * Validates that listing VDP URLs point to live, active vehicle pages.
 * Run server-side during report creation after MarketCheck data is fetched.
 *
 * Strategy: HEAD REQUESTS + REDIRECT DETECTION
 * - Uses HEAD requests instead of GET to avoid triggering bot-protection on dealer
 *   websites (Cloudflare, Imperva, etc. are less aggressive against HEAD).
 * - Accepts HTTP 200 and 405 (Method Not Allowed — the server responded to our
 *   specific URL, which means the page exists even if HEAD isn't supported).
 * - Rejects timeouts, 404s, 403s, cross-domain redirects, and homepage/index redirects.
 * - Requires at least 2 path segments on the final URL to reject homepages ("/") and
 *   single-segment index pages ("/inventory") while accepting common 2-segment VDP
 *   formats like "/inventory/12345" or "/used-vehicles/vin123456".
 * - Validates in batches of 20 (sorted by dos_active by default, or by a caller-supplied sortFn) and stops as soon as
 *   TARGET_VALID (10) passing listings are found.
 */

import type { MarketCheckPrediction, MarketCheckComparable } from '@/lib/api/marketcheck-client'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'

const VALIDATION_TIMEOUT_MS = 8000
const BATCH_SIZE = 20
const TARGET_VALID = 10

export interface ValidationStats {
  /** Total number of URLs actually fetched (excludes no-vdp_url listings) */
  checkedCount: number
  /** Number of URLs that failed validation */
  failedCount: number
  /** The specific URLs that failed */
  failedUrls: string[]
  /** The specific URLs that passed validation */
  validatedUrls: string[]
  /** How many batches of 20 were needed to reach TARGET_VALID */
  batchesUsed: number
}

async function fetchOnce(url: string, method: 'HEAD' | 'GET'): Promise<boolean> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), VALIDATION_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      method,
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    })

    if (response.status !== 200 && response.status !== 405) return false

    const parsedOriginal = new URL(url)
    const parsedFinal = new URL(response.url)
    if (parsedOriginal.hostname !== parsedFinal.hostname) return false

    const finalPath = parsedFinal.pathname
    if (finalPath === '/' || finalPath === '') return false
    const pathSegments = finalPath.split('/').filter(s => s.length > 0)
    if (pathSegments.length < 2) return false

    return true
  } catch {
    return false
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * Check a single URL. Tries a HEAD request first (cheap); if that doesn't
 * pass, retries once with GET before giving up — some dealer sites block or
 * mishandle HEAD specifically while serving GET normally, which was
 * confirmed to be producing false "dead link" results (a link that opens
 * fine in a real browser but fails this check) — see
 * docs/comp-selection-process-2026-08-26.md, Step 4.
 */
async function checkUrl(url: string): Promise<boolean> {
  if (await fetchOnce(url, 'HEAD')) return true
  return fetchOnce(url, 'GET')
}

/**
 * Validate listing URLs in a MarketCheckPrediction using sequential batching.
 *
 * - Sorts all listings using the provided sortFn if supplied, otherwise defaults to dos_active (ascending). Processes in batches
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
  prediction: MarketCheckPrediction,
  options?: { sortFn?: (listings: MarketCheckComparable[]) => MarketCheckComparable[] }
): Promise<{ prediction: MarketCheckPrediction; stats: ValidationStats }> {
  const emptyStats: ValidationStats = {
    checkedCount: 0,
    failedCount: 0,
    failedUrls: [],
    validatedUrls: [],
    batchesUsed: 0,
  }

  if (!prediction.recentComparables?.listings?.length) {
    return { prediction, stats: emptyStats }
  }

  const allListings = prediction.recentComparables.listings

  // Sort listings: use provided sortFn, or default to dos_active ascending.
  // Listings without dos_active get Infinity, sinking them to the bottom.
  const sortedListings = options?.sortFn
    ? options.sortFn(allListings)
    : [...allListings].sort((a, b) => (a.dos_active ?? Infinity) - (b.dos_active ?? Infinity))

  const validListingSet = new Set<MarketCheckComparable>()
  const stats: ValidationStats = {
    checkedCount: 0,
    failedCount: 0,
    failedUrls: [],
    validatedUrls: [],
    batchesUsed: 0,
  }

  // Process batches sequentially; each batch runs its fetches in parallel.
  // Stop as soon as TARGET_VALID (10) listings with passing URLs have been found.
  for (
    let offset = 0;
    offset < sortedListings.length && validListingSet.size < TARGET_VALID;
    offset += BATCH_SIZE
  ) {
    const batch = sortedListings.slice(offset, offset + BATCH_SIZE)
    stats.batchesUsed++

    const batchResults = await Promise.allSettled(
      batch.map(async listing => {
        if (!listing.vdp_url) {
          // No URL: auto-valid, don't count as a URL check
          return { listing, valid: true, url: null }
        }
        const valid = await checkUrl(listing.vdp_url)
        return { listing, valid, url: listing.vdp_url }
      })
    )

    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        const { listing, valid, url } = result.value
        if (url !== null) {
          // Only count listings where we actually fetched a URL
          stats.checkedCount++
          if (valid) {
            stats.validatedUrls.push(url)
          } else {
            stats.failedCount++
            stats.failedUrls.push(url)
          }
        }
        if (valid) {
          validListingSet.add(listing)
        }
      }
    }
  }

  // Annotate every listing with url_validated
  const validatedListings = allListings.map(listing => ({
    ...listing,
    url_validated: validListingSet.has(listing),
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
