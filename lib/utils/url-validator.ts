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
 * - Also classifies *why* a check failed (url_check_result): 'dead' (404/410 or other
 *   non-200/405), 'blocked' (403/429 — usually bot-protection, not a genuinely gone
 *   page), 'transient' (>=500, timeout, or network error), 'redirected' (cross-host or
 *   shallow-path redirect). Passing checks are 'valid'. The pass/fail decision is
 *   unchanged — this is only extra signal for the display-time back-fill (Task 5).
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

/**
 * Why a link check resolved the way it did.
 * - 'valid'      — the URL passed every check (or the listing has no vdp_url to check)
 * - 'dead'       — 404/410, or any other non-200/405 status; the page looks genuinely gone
 * - 'blocked'    — 403/429; almost always bot-protection blocking us, not a dead page
 * - 'transient'  — >=500, a timeout, or a network error; retrying later might succeed
 * - 'redirected' — landed on a different host, the homepage, or a too-shallow path
 */
export type CheckReason = 'valid' | 'dead' | 'blocked' | 'transient' | 'redirected'

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

async function fetchOnce(
  url: string,
  method: 'HEAD' | 'GET'
): Promise<{ ok: boolean; reason: CheckReason }> {
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

    // Classify the failure reason, but keep the pass criteria byte-identical to
    // before: a URL passes iff final status is 200 or 405, final hostname matches
    // the original, and the final path has >= 2 non-empty segments.
    if (response.status === 403 || response.status === 429) return { ok: false, reason: 'blocked' }
    if (response.status === 404 || response.status === 410) return { ok: false, reason: 'dead' }
    if (response.status >= 500) return { ok: false, reason: 'transient' }
    if (response.status !== 200 && response.status !== 405) return { ok: false, reason: 'dead' }

    const parsedOriginal = new URL(url)
    const parsedFinal = new URL(response.url)
    if (parsedOriginal.hostname !== parsedFinal.hostname) return { ok: false, reason: 'redirected' }

    const finalPath = parsedFinal.pathname
    if (finalPath === '/' || finalPath === '') return { ok: false, reason: 'redirected' }
    const pathSegments = finalPath.split('/').filter(s => s.length > 0)
    if (pathSegments.length < 2) return { ok: false, reason: 'redirected' }

    return { ok: true, reason: 'valid' }
  } catch {
    return { ok: false, reason: 'transient' }
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
 *
 * Returns both the pass/fail bit and the classified reason. When the GET retry
 * also fails, prefer the more informative of the two reasons: a definite GET
 * result (e.g. 'dead') beats a HEAD that only timed out ('transient').
 */
async function checkUrl(url: string): Promise<{ ok: boolean; reason: CheckReason }> {
  const head = await fetchOnce(url, 'HEAD')
  if (head.ok) return head
  const get = await fetchOnce(url, 'GET')
  return get.ok ? get : get.reason === 'transient' ? head : get
}

/**
 * Validate listing URLs in a MarketCheckPrediction using sequential batching.
 *
 * - Sorts all listings using the provided sortFn if supplied, otherwise defaults to dos_active (ascending). Processes in batches
 *   of BATCH_SIZE (20). Each batch is validated in parallel.
 * - Stops as soon as TARGET_VALID (10) listings with passing URLs are found.
 *   Additional batches are only fetched if the previous batch did not supply enough.
 * - Annotates listings with url_validated (tri-state) and url_check_result:
 *   - Checked and passed → url_validated: true,  url_check_result: 'valid'
 *   - Checked and failed → url_validated: false, url_check_result: the reason
 *     ('dead' | 'blocked' | 'transient' | 'redirected')
 *   - Never checked (below early-stop) → both keys absent from the object
 *   - No vdp_url → url_validated: true, url_check_result: 'valid' (no link, data valid)
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
  const checkedSet = new Set<MarketCheckComparable>()
  // Why each checked listing's link check resolved the way it did. Populated for
  // every listing that actually had its vdp_url fetched (Task 5 orders the
  // display-time back-fill by this, preferring 'blocked' over 'dead').
  const reasonByListing = new Map<MarketCheckComparable, CheckReason>()
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
          return { listing, valid: true, reason: 'valid' as const, url: null }
        }
        const { ok: valid, reason } = await checkUrl(listing.vdp_url)
        return { listing, valid, reason, url: listing.vdp_url }
      })
    )

    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        const { listing, valid, reason, url } = result.value
        if (url !== null) {
          checkedSet.add(listing)
          reasonByListing.set(listing, reason)
          stats.checkedCount++
          if (valid) stats.validatedUrls.push(url)
          else {
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

  // Annotate every listing with url_validated (tri-state) + url_check_result:
  // - checked and passed → true,  'valid'
  // - checked and failed → false, the classified reason
  // - never checked → both keys absent from object
  // - no vdp_url → true, 'valid' (valid data, just no link)
  const validatedListings = allListings.map(listing => {
    if (validListingSet.has(listing)) {
      return { ...listing, url_validated: true, url_check_result: 'valid' as CheckReason }
    }
    if (checkedSet.has(listing)) {
      return {
        ...listing,
        url_validated: false,
        url_check_result: reasonByListing.get(listing) as CheckReason,
      }
    }
    if (!listing.vdp_url) {
      // no link to check — data still valid
      return { ...listing, url_validated: true, url_check_result: 'valid' as CheckReason }
    }
    const {
      url_validated: _drop,
      url_check_result: _dropReason,
      ...rest
    } = listing as MarketCheckComparable & {
      url_validated?: boolean
      url_check_result?: CheckReason
    }
    void _drop
    void _dropReason
    return rest as MarketCheckComparable // never checked -> leave both keys undefined
  })

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
