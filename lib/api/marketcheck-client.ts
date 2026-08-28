/**
 * MarketCheck API Client - Production Version
 *
 * Fetches price predictions and comparable vehicle listings from MarketCheck API.
 * API Tier: Premium (up to 1,000 comparables returned)
 * Cost: ~$0.09 per prediction call
 *
 * IMPORTANT: This is the PRIMARY valuation source (replaces CarsXE)
 *
 * DATA STORAGE:
 * - Cleans listings via cleanAndFilterComparables (removes new/zero-mile, dedupes VINs, caps per-dealer)
 * - Filtered by year range relative to the subject vehicle when year is provided
 * - Sorted by price (highest first) for consistency
 *
 * @see https://docs.marketcheck.com/docs/api/cars/market-insights/marketcheck-price
 */

import { cleanAndFilterComparables } from '@/lib/utils/comparables-cleaner'
import { computeDistanceMiles, DISTANCE_TIER_MILES } from '@/lib/utils/geo-distance'
import { splitModelAndBodyType } from '@/lib/utils/vehicle-model'
import { logApiCall } from '@/lib/api/api-call-logger'

// Retry configuration interface
interface RetryConfig {
  maxAttempts: number
  initialDelayMs: number
  maxDelayMs: number
  backoffMultiplier: number
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelayMs: 1000, // 1 second
  maxDelayMs: 8000, // 8 seconds max
  backoffMultiplier: 2, // Exponential: 1s, 2s, 4s
}

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Calculate exponential backoff delay
 */
function calculateBackoffDelay(attempt: number, config: RetryConfig): number {
  const delay = config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt - 1)
  return Math.min(delay, config.maxDelayMs)
}

/**
 * Fire-and-forget observability write for one fallback-search attempt.
 * An `api_call_logs` write must never break report creation, so this swallows
 * every outcome — a synchronous throw, a rejected promise, or a mocked
 * `logApiCall` that returns a non-promise.
 */
function logSearchAttempt(params: Parameters<typeof logApiCall>[0]): void {
  try {
    void Promise.resolve(logApiCall(params)).catch(() => {})
  } catch {
    /* observability only — never rethrow */
  }
}

// Premium API Statistical Data Interfaces
export interface StatisticalData {
  min: number
  max: number
  count: number
  missing: number
  sum: number
  mean: number
  stddev: number
  sum_of_squares: number
  median: number
  percentiles: {
    '5.0': number
    '25.0': number
    '50.0': number
    '75.0': number
    '90.0': number
    '95.0': number
    '99.0': number
  }
}

export interface ComparableStats {
  price: StatisticalData
  miles: StatisticalData
  dos_active: StatisticalData
}

export interface MarketCheckComparable {
  // Basic vehicle info
  id?: string
  vin?: string
  year: number
  make: string
  model: string
  trim?: string

  // Pricing and mileage
  miles: number
  price: number

  // Days on market data (Premium API)
  dom?: number // Days on market
  dom_180?: number // Days on market (180-day period)
  dom_active?: number // Days on market (active period)
  dos_active?: number // Days on site (active period)

  // Dealer information
  dealer_type?: 'franchise' | 'independent'
  dealer_id?: number
  dealer_name?: string

  // Location data
  location?: {
    city?: string
    state?: string
    zip?: string
    distance_miles?: number
  }
  latitude?: string
  longitude?: string

  // Media and metadata
  photo_url?: string
  vdp_url?: string // Vehicle Details Page URL
  url_validated?: boolean // Set by validateListingUrls() during report creation
  /**
   * Why the link check resolved the way it did. Set alongside url_validated by
   * validateListingUrls() for every checked listing (valid ⇔ url_validated === true);
   * absent on never-checked listings. Task 5's display-time back-fill orders by this.
   */
  url_check_result?: 'valid' | 'dead' | 'blocked' | 'transient' | 'redirected'
  listing_date?: string
  mc_website_id?: number
  source: string

  /** Which acquisition path produced this listing. Set once at fetch/map time,
   * before merge into recentComparables.listings. Absent on reports created
   * before 2026-08-27 → treated as primary by the selector. */
  source_tier?: 'franchise' | 'independent' | 'fallback_search'
}

export interface MarketCheckPrediction {
  // Primary prediction
  predictedPrice: number
  msrp?: number // Manufacturer's Suggested Retail Price

  // Price range
  priceRange?: {
    min: number
    max: number
  }

  // Confidence and metadata
  confidence: 'low' | 'medium' | 'high'
  dataSource: 'marketcheck'
  requestParams: {
    vin: string
    miles: number
    zip: string
    dealer_type: 'franchise' | 'independent' | 'both'
  }

  // Total comparables found (metadata only - listings not stored)
  totalComparablesFound: number

  // Statistical analysis from ALL comparables (Premium API)
  comparablesStats?: ComparableStats

  // Set by the LemonSqueezy webhook when recentComparables.listings ends up
  // empty after every supplement — the render surfaces show an explicit
  // "valuation rests on statistical data" line and the report is flagged for
  // manual review. Persists with the blob; no migration. No delivery gate.
  compsEmpty?: boolean

  // Recent comparables (Premium API - actual sales data) - ONLY THESE LISTINGS ARE STORED
  recentComparables?: {
    num_found: number
    listings: MarketCheckComparable[]
    stats?: ComparableStats
  }

  generatedAt: string
}

export interface MarketCheckResponse {
  success: boolean
  data?: MarketCheckPrediction
  error?: string
  statusCode?: number
  fallbackUsed?: boolean // true when search fallback was used instead of VIN prediction
}

/**
 * Fallback: fetch comparables via search endpoint when VIN decode fails.
 * Uses MarketCheck search API to find comparable vehicles by year/make/model.
 */
export async function fetchMarketCheckSearchFallback(
  apiKey: string,
  year: number,
  make: string,
  model: string,
  vin: string,
  miles: number,
  zip: string,
  start: number = 0,
  reportId?: string
): Promise<MarketCheckResponse> {
  // zip is omitted — passing zip without radius returns 0 results (API treats it as 0-mile
  // radius). The search endpoint also never returns a distance field, so geo-sorting is
  // not possible here; year-closeness sort is applied post-fetch instead.
  // NOTE: year IS passed on attempt 1 — without it the API returns new-inventory (2026+)
  // exclusively, which is all 0-mile stock that the year-filter and usedOnly-filter then
  // drop entirely. year is only dropped as a last-resort widening step (attempts 3–4).
  //
  // The auto.dev VIN decoder glues the body style onto the model string ("Civic Coupe"),
  // but MarketCheck's for-sale index keys on the canonical model ("Civic") with the body
  // style in a separate `body_type` filter — a literal `model=Civic Coupe` search returns
  // zero. Split the trailing body-style token off and re-send it as `body_type` so the
  // recovered comps are the right body style (a coupe valued against coupes, not sedans).
  // If that body-typed search is too thin we progressively widen. When the model is already
  // canonical (Grand Highlander, F-150, XC90…) nothing is split and attempt 1 is the only
  // call, with its original empty-result behaviour unchanged.
  const MIN_VALID = 10
  const { model: baseModel, bodyType } = splitModelAndBodyType(model)

  type SearchOutcome =
    | { ok: true; numFound: number; listings: unknown[] }
    | { ok: false; response: MarketCheckResponse }

  const runSearch = async (
    label: string,
    opts: { useBodyType: boolean; useYear: boolean }
  ): Promise<SearchOutcome> => {
    const startedAt = Date.now()
    // Every attempt (1–4) is logged here, once, so api_call_logs records the exact
    // params + outcome of each rung of the widening ladder. Fire-and-forget — an
    // observability write must never break report creation.
    const attemptRequestData = {
      attempt: label,
      make,
      model: baseModel,
      body_type: opts.useBodyType && bodyType ? bodyType : undefined,
      year: opts.useYear ? year : undefined,
      start,
      rows: 50,
    }

    const url = new URL('https://api.marketcheck.com/v2/search/car/active')
    url.searchParams.append('api_key', apiKey)
    url.searchParams.append('make', make)
    url.searchParams.append('model', baseModel)
    if (opts.useBodyType && bodyType) url.searchParams.append('body_type', bodyType)
    if (opts.useYear) url.searchParams.append('year', year.toString())
    url.searchParams.append('rows', '50')
    url.searchParams.append('start', start.toString())

    console.log('[MarketCheck Fallback] Trying search endpoint', {
      attempt: label,
      make,
      model: baseModel,
      body_type: opts.useBodyType && bodyType ? bodyType : undefined,
      year: opts.useYear ? year : undefined,
      start,
    })

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'VehicleValuationSaaS/1.0' },
      signal: AbortSignal.timeout(30000),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[MarketCheck Fallback] Search failed', {
        attempt: label,
        status: response.status,
        body: errorText,
      })
      const errorMessage = `MarketCheck search fallback failed: ${response.status} ${response.statusText}`
      logSearchAttempt({
        reportId,
        provider: 'marketcheck',
        endpoint: '/v2/search/car/active',
        success: false,
        responseTimeMs: Date.now() - startedAt,
        cost: 0,
        requestData: attemptRequestData,
        responseData: { num_found: 0, returned: 0, status: response.status },
        errorMessage,
      })
      return {
        ok: false,
        response: {
          success: false,
          error: errorMessage,
          statusCode: response.status,
        },
      }
    }

    const data = (await response.json()) as { num_found: number; listings: unknown[] }
    const listingsOut = data.listings || []
    const numFoundOut = typeof data.num_found === 'number' ? data.num_found : listingsOut.length

    console.log('[MarketCheck Fallback] Search succeeded', {
      attempt: label,
      num_found: numFoundOut,
      returned: listingsOut.length,
    })

    logSearchAttempt({
      reportId,
      provider: 'marketcheck',
      endpoint: '/v2/search/car/active',
      success: numFoundOut > 0,
      responseTimeMs: Date.now() - startedAt,
      cost: 0,
      requestData: attemptRequestData,
      responseData: { num_found: numFoundOut, returned: listingsOut.length },
    })

    return { ok: true, numFound: numFoundOut, listings: listingsOut }
  }

  try {
    // ── Attempt 1: canonical model + body_type (if split) + year ──────────────────
    const a1 = await runSearch('1 (model + body_type + year)', {
      useBodyType: true,
      useYear: true,
    })
    if (!a1.ok) return a1.response
    let best: { numFound: number; listings: unknown[] } = a1

    // The widening ladder (attempts 2–4) only runs when a body-style token was split off.
    if (bodyType) {
      // ── Attempt 2: drop body_type, keep year — only if attempt 1 came back thin ──
      if (best.numFound < MIN_VALID) {
        const a2 = await runSearch('2 (model + year, no body_type)', {
          useBodyType: false,
          useYear: true,
        })
        if (!a2.ok) return a2.response
        // Keep the wider set — downstream ranking sorts by best match, so a
        // relevant-where-possible table beats an empty one. Never regress to fewer.
        if (a2.listings.length >= best.listings.length) best = a2
      }

      // ── Attempt 3: keep body_type, drop year — only if still nothing at all ─────
      if (best.numFound === 0) {
        const a3 = await runSearch('3 (model + body_type, no year)', {
          useBodyType: true,
          useYear: false,
        })
        if (!a3.ok) return a3.response
        if (a3.listings.length > 0) best = a3
      }

      // ── Attempt 4: bare model, no body_type, no year — last resort ─────────────
      if (best.numFound === 0) {
        const a4 = await runSearch('4 (model only)', { useBodyType: false, useYear: false })
        if (!a4.ok) return a4.response
        if (a4.listings.length > 0) best = a4
      }
    }

    const listings = best.listings
    const numFound = best.numFound

    if (listings.length === 0) {
      return {
        success: false,
        error: 'MarketCheck search fallback returned no listings',
        statusCode: 404,
      }
    }

    // Map search listings to MarketCheckComparable shape
    const comparables: MarketCheckComparable[] = listings
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((l: any) => ({
        id: l.id,
        vin: l.vin,
        year: l.build?.year ?? l.year ?? year,
        make: l.build?.make ?? l.make ?? make,
        model: l.build?.model ?? l.model ?? model,
        trim: l.build?.trim ?? l.trim,
        miles: l.miles ?? 0,
        price: l.price ?? 0,
        dom: l.dom,
        dom_180: l.dom_180,
        dom_active: l.dom_active,
        dos_active: l.dos_active,
        dealer_type: (l.seller_type === 'franchise' ? 'franchise' : 'independent') as
          | 'franchise'
          | 'independent',
        dealer_id: l.seller_id,
        dealer_name: l.dealer?.name,
        location:
          l.dealer_address || l.dealer
            ? {
                city: l.dealer_address?.city ?? l.dealer?.city,
                state: l.dealer_address?.state ?? l.dealer?.state,
                zip: l.dealer_address?.zip ?? l.dealer?.zip,
                distance_miles: l.distance ?? undefined,
              }
            : undefined,
        latitude: l.latitude,
        longitude: l.longitude,
        photo_url: l.media?.photo_links?.[0],
        vdp_url: l.vdp_url,
        listing_date: l.first_seen_at_date ?? l.first_seen_at,
        mc_website_id: l.mc_website_id,
        source: 'marketcheck',
        source_tier: 'fallback_search' as const,
      }))
      .sort((a, b) => b.price - a.price)

    // Clean before pricing off of — or storing — anything: the same rules every
    // other comp goes through (0-mile/0-price junk, dupes, year band, dealer cap).
    // The VIN-matched path already runs this; the fallback path must too, or its
    // raw "call for price" ($0) listings end up on the report.
    const cleaned = cleanAndFilterComparables(comparables, year)

    // Prefer pricing off genuinely local comps when we know the subject ZIP
    // — falls back to the full cleaned set if nothing is within the widest
    // distance tier, so the price is never computed from zero data.
    const localRadius = DISTANCE_TIER_MILES[DISTANCE_TIER_MILES.length - 1]
    const nearby = zip
      ? cleaned.filter(l => {
          const dist = computeDistanceMiles(zip, l)
          return dist !== null && dist <= localRadius
        })
      : []
    const pricingPool = nearby.length > 0 ? nearby : cleaned

    // Synthesise predicted price as mean of listing prices
    const prices = pricingPool.map(l => l.price).filter(p => p > 0)
    const predictedPrice =
      prices.length > 0 ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : 0

    // Synthesise price range from 10th/90th percentile
    const sorted = [...prices].sort((a, b) => a - b)
    const p10 = sorted[Math.floor(sorted.length * 0.1)] ?? sorted[0] ?? 0
    const p90 = sorted[Math.floor(sorted.length * 0.9)] ?? sorted[sorted.length - 1] ?? 0

    // Confidence based on listing count
    const confidence: 'low' | 'medium' | 'high' =
      pricingPool.length >= 20 ? 'high' : pricingPool.length >= 5 ? 'medium' : 'low'

    const prediction: MarketCheckPrediction = {
      predictedPrice,
      priceRange: { min: p10, max: p90 },
      confidence,
      dataSource: 'marketcheck',
      requestParams: { vin, miles, zip, dealer_type: 'franchise' },
      totalComparablesFound: numFound,
      comparablesStats: undefined,
      recentComparables: {
        num_found: cleaned.length,
        listings: cleaned,
        stats: undefined,
      },
      generatedAt: new Date().toISOString(),
    }

    return { success: true, data: prediction, fallbackUsed: true }
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error('[MarketCheck Fallback] Exception:', msg)
    return { success: false, error: msg, statusCode: 500 }
  }
}

/**
 * Fetch price prediction from MarketCheck API with retry logic
 *
 * @param vin - Vehicle Identification Number (17 characters)
 * @param miles - Current mileage
 * @param zipCode - ZIP code for location-based pricing
 * @param isCertified - Whether vehicle is certified pre-owned (default: false)
 * @param retryConfig - Retry configuration (optional)
 * @param subjectVehicle - Subject vehicle info used to filter comparables. The `year` field
 *   drives year-range filtering inside `cleanAndFilterComparables`; `make`, `model`, and
 *   `trim` are used as a VIN-decode fallback when the MarketCheck response is incomplete.
 * @param dealerType - MarketCheck requires this on every call to this endpoint and only
 *   accepts 'franchise' or 'independent' — there is no "both" value. Defaults to 'franchise'
 *   to preserve this app's existing default. To surface both dealer types, call this twice
 *   (see `lib/utils/dealer-type-supplementer.ts`, which does so only when the first call's
 *   results come up short).
 * @returns Price prediction with comparables filtered by `cleanAndFilterComparables`
 */
export async function fetchMarketCheckData(
  vin: string,
  miles: number,
  zipCode: string,
  isCertified: boolean = false,
  retryConfig: RetryConfig = DEFAULT_RETRY_CONFIG,
  subjectVehicle?: {
    year?: number
    make?: string
    model?: string
    trim?: string
  },
  dealerType: 'franchise' | 'independent' = 'franchise'
): Promise<MarketCheckResponse> {
  const apiKey = process.env.MARKETCHECK_API_KEY

  if (!apiKey) {
    return {
      success: false,
      error: 'MarketCheck API key not configured',
      statusCode: 500,
    }
  }

  // Input validation
  if (!vin || vin.length !== 17) {
    return {
      success: false,
      error: 'Invalid VIN format (must be 17 characters)',
      statusCode: 400,
    }
  }

  if (miles < 0 || miles > 999999) {
    return {
      success: false,
      error: 'Invalid mileage (must be 0-999,999)',
      statusCode: 400,
    }
  }

  if (!zipCode || !/^\d{5}$/.test(zipCode)) {
    return {
      success: false,
      error: 'Invalid ZIP code format (must be 5 digits)',
      statusCode: 400,
    }
  }

  // Retry loop
  let lastError: Error | null = null
  const startTime = Date.now()

  for (let attempt = 1; attempt <= retryConfig.maxAttempts; attempt++) {
    try {
      // CORRECTED ENDPOINT: /comparables for premium service
      const url = new URL(
        'https://api.marketcheck.com/v2/predict/car/us/marketcheck_price/comparables'
      )
      url.searchParams.append('api_key', apiKey)
      url.searchParams.append('vin', vin)
      url.searchParams.append('miles', miles.toString())
      url.searchParams.append('zip', zipCode)
      url.searchParams.append('dealer_type', dealerType)
      url.searchParams.append('is_certified', isCertified ? 'true' : 'false')

      // Log the full URL (masking API key for security)
      const debugUrl = url.toString().replace(apiKey, 'API_KEY_HIDDEN')
      console.log(`[MarketCheck] Attempt ${attempt}/${retryConfig.maxAttempts}`, {
        vin,
        miles,
        zipCode,
        dealer_type: dealerType,
        is_certified: isCertified,
        fullUrl: debugUrl,
      })

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'VehicleValuationSaaS/1.0',
        },
        signal: AbortSignal.timeout(30000), // 30 second timeout
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('[MarketCheck] API error:', {
          attempt,
          status: response.status,
          statusText: response.statusText,
          body: errorText,
        })

        // Determine if error is retryable
        const isRetryable = response.status >= 500 || response.status === 429

        if (!isRetryable || attempt === retryConfig.maxAttempts) {
          // Check if this is a VIN decode failure — try search fallback
          const isVinDecodeFailure =
            response.status === 400 && errorText.includes('Failed to decode VIN')

          if (
            isVinDecodeFailure &&
            subjectVehicle?.year &&
            subjectVehicle?.make &&
            subjectVehicle?.model
          ) {
            console.log('[MarketCheck] VIN decode failed — attempting search fallback')
            return fetchMarketCheckSearchFallback(
              apiKey,
              subjectVehicle.year,
              subjectVehicle.make,
              subjectVehicle.model,
              vin,
              miles,
              zipCode
            )
          }

          return {
            success: false,
            error: `MarketCheck API error: ${response.status} ${response.statusText}`,
            statusCode: response.status,
          }
        }

        // Retry on server errors or rate limits
        const backoffDelay = calculateBackoffDelay(attempt, retryConfig)
        console.log(`[MarketCheck] Retrying after ${backoffDelay}ms...`)
        await sleep(backoffDelay)
        continue
      }

      const data = await response.json()
      const responseTime = Date.now() - startTime

      console.log('[MarketCheck] Success', {
        attempt,
        responseTimeMs: responseTime,
        price: data.marketcheck_price || data.price,
        comparablesFound: data.comparables?.num_found || 0,
        recentComparablesFound: data.recent_comparables?.num_found || 0,
        recentListingsCount: data.recent_comparables?.listings?.length || 0,
      })

      // Transform MarketCheck Premium API response to our format
      // IMPORTANT: Only store recent_comparables listings, but keep all statistics
      const prediction: MarketCheckPrediction = {
        // Primary prediction
        predictedPrice: data.marketcheck_price || data.price || data.predicted_price || 0,
        msrp: data.msrp,

        // Price range
        priceRange: data.price_range
          ? {
              min: data.price_range.min || data.price_range.low,
              max: data.price_range.max || data.price_range.high,
            }
          : {
              min: Math.round((data.marketcheck_price || data.price || 0) * 0.9),
              max: Math.round((data.marketcheck_price || data.price || 0) * 1.1),
            },

        // Confidence and metadata
        confidence: mapConfidenceLevel(data.confidence || data.confidence_score),
        dataSource: 'marketcheck',
        requestParams: {
          vin,
          miles,
          zip: zipCode,
          dealer_type: dealerType,
        },

        // Total comparables found (metadata only - listings NOT stored)
        totalComparablesFound:
          data.comparables?.num_found || data.total_listings || data.total || 0,

        // Statistical analysis from ALL comparables (Premium API)
        // IMPORTANT: These stats are from the full comparables dataset
        comparablesStats: data.comparables?.stats,

        // Recent comparables (Premium API - actual sales data)
        // Cleaned via cleanAndFilterComparables before storage
        recentComparables: data.recent_comparables
          ? {
              num_found: data.recent_comparables.num_found || 0,
              listings: cleanAndFilterComparables(
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                ((data.recent_comparables.listings || []) as any[])
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  .map((listing: any) => ({
                    // Basic vehicle info
                    id: listing.id,
                    vin: listing.vin,
                    year: listing.year || listing.build?.year,
                    make: listing.make || listing.build?.make,
                    model: listing.model || listing.build?.model,
                    trim: listing.trim || listing.build?.trim,

                    // Pricing and mileage
                    miles: listing.miles || listing.mileage || 0,
                    price: listing.price || listing.asking_price || 0,

                    // Days on market data (Premium API)
                    dom: listing.dom,
                    dom_180: listing.dom_180,
                    dom_active: listing.dom_active,
                    dos_active: listing.dos_active,

                    // Dealer information
                    dealer_type: listing.dealer_type,
                    dealer_id: listing.dealer_id,

                    // Location data
                    location:
                      listing.dealer_address || listing.location
                        ? {
                            city: listing.dealer_address?.city || listing.location?.city,
                            state: listing.dealer_address?.state || listing.location?.state,
                            zip: listing.dealer_address?.zip || listing.location?.zip,
                            distance_miles: listing.dist || listing.distance || 0,
                          }
                        : undefined,
                    latitude: listing.latitude,
                    longitude: listing.longitude,

                    // Media and metadata
                    photo_url: listing.photo_url,
                    listing_date: listing.first_seen_at || listing.created_at,
                    mc_website_id: listing.mc_website_id,
                    source: 'marketcheck',
                    vdp_url: listing.vdp_url,
                    dealer_name: listing.dealer_name,
                    source_tier: dealerType,
                  })),
                subjectVehicle?.year
              ).sort((a, b) => b.price - a.price),
              stats: data.recent_comparables.stats,
            }
          : undefined,

        generatedAt: new Date().toISOString(),
      }

      return {
        success: true,
        data: prediction,
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error')
      console.error(`[MarketCheck] Exception on attempt ${attempt}:`, lastError)

      if (attempt === retryConfig.maxAttempts) {
        break
      }

      const backoffDelay = calculateBackoffDelay(attempt, retryConfig)
      console.log(`[MarketCheck] Retrying after ${backoffDelay}ms...`)
      await sleep(backoffDelay)
    }
  }

  // All retries exhausted
  return {
    success: false,
    error: lastError?.message || 'MarketCheck API request failed after retries',
    statusCode: 500,
  }
}

/**
 * Map MarketCheck confidence to our standard levels
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapConfidenceLevel(apiConfidence: any): 'low' | 'medium' | 'high' {
  if (typeof apiConfidence === 'string') {
    const lower = apiConfidence.toLowerCase()
    if (lower.includes('high')) return 'high'
    if (lower.includes('medium') || lower.includes('moderate')) return 'medium'
    return 'low'
  }

  if (typeof apiConfidence === 'number') {
    // Assume 0-100 scale
    if (apiConfidence >= 80) return 'high'
    if (apiConfidence >= 50) return 'medium'
    return 'low'
  }

  return 'medium' // Default
}

/**
 * Mock MarketCheck data for development/testing
 * Use this until API key is configured
 */
export async function fetchMarketCheckDataMock(
  vin: string,
  miles: number,
  zipCode: string
): Promise<MarketCheckResponse> {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 2000))

  // Calculate mock price based on inputs
  const basePrice = 20000
  const mileageAdjustment = (100000 - miles) * 0.08
  const dealerTypeAdjustment = 1500 // Always franchise
  const predictedPrice = Math.round(basePrice + mileageAdjustment + dealerTypeAdjustment)

  const mockListings = [
    {
      vin: '1HGCM82633A789012',
      year: 2020,
      make: 'Honda',
      model: 'Civic',
      trim: 'EX',
      miles: 38000,
      price: 22800,
      dealer_type: 'franchise' as const,
      location: {
        city: 'Los Angeles',
        state: 'CA',
        zip: '90025',
        distance_miles: 5.2,
      },
      listing_date: '2024-12-10',
      days_on_market: 9,
      source: 'marketcheck' as const,
    },
    {
      vin: '1HGCM82633A456789',
      year: 2020,
      make: 'Honda',
      model: 'Civic',
      trim: 'LX',
      miles: 45000,
      price: 20500,
      dealer_type: 'independent' as const,
      location: {
        city: 'Pasadena',
        state: 'CA',
        zip: '91101',
        distance_miles: 12.8,
      },
      listing_date: '2024-12-05',
      days_on_market: 14,
      source: 'marketcheck' as const,
    },
    {
      vin: '1HGCM82633A234567',
      year: 2020,
      make: 'Honda',
      model: 'Civic',
      trim: 'EX-L',
      miles: 32000,
      price: 24200,
      dealer_type: 'franchise' as const,
      location: {
        city: 'Santa Monica',
        state: 'CA',
        zip: '90401',
        distance_miles: 8.5,
      },
      listing_date: '2024-12-12',
      days_on_market: 7,
      source: 'marketcheck' as const,
    },
    {
      vin: '1HGCM82633A345678',
      year: 2019,
      make: 'Honda',
      model: 'Civic',
      trim: 'Sport',
      miles: 52000,
      price: 19800,
      dealer_type: 'franchise' as const,
      location: {
        city: 'Burbank',
        state: 'CA',
        zip: '91501',
        distance_miles: 15.3,
      },
      listing_date: '2024-11-28',
      days_on_market: 21,
      source: 'marketcheck' as const,
    },
    {
      vin: '1HGCM82633A567890',
      year: 2021,
      make: 'Honda',
      model: 'Civic',
      trim: 'Touring',
      miles: 28000,
      price: 25500,
      dealer_type: 'franchise' as const,
      location: {
        city: 'Glendale',
        state: 'CA',
        zip: '91201',
        distance_miles: 10.1,
      },
      listing_date: '2024-12-15',
      days_on_market: 4,
      source: 'marketcheck' as const,
    },
    {
      vin: '1HGCM82633A678901',
      year: 2020,
      make: 'Honda',
      model: 'Civic',
      trim: 'LX',
      miles: 48000,
      price: 20100,
      dealer_type: 'independent' as const,
      location: {
        city: 'Long Beach',
        state: 'CA',
        zip: '90802',
        distance_miles: 22.7,
      },
      listing_date: '2024-12-01',
      days_on_market: 18,
      source: 'marketcheck' as const,
    },
    {
      vin: '1HGCM82633A789123',
      year: 2020,
      make: 'Honda',
      model: 'Civic',
      trim: 'EX',
      miles: 41000,
      price: 22200,
      dealer_type: 'franchise' as const,
      location: {
        city: 'Torrance',
        state: 'CA',
        zip: '90501',
        distance_miles: 18.9,
      },
      listing_date: '2024-12-08',
      days_on_market: 11,
      source: 'marketcheck' as const,
    },
    {
      vin: '1HGCM82633A890234',
      year: 2019,
      make: 'Honda',
      model: 'Civic',
      trim: 'EX-L',
      miles: 55000,
      price: 21400,
      dealer_type: 'independent' as const,
      location: {
        city: 'Anaheim',
        state: 'CA',
        zip: '92801',
        distance_miles: 28.4,
      },
      listing_date: '2024-11-22',
      days_on_market: 27,
      source: 'marketcheck' as const,
    },
    {
      vin: '1HGCM82633A901345',
      year: 2021,
      make: 'Honda',
      model: 'Civic',
      trim: 'Sport',
      miles: 25000,
      price: 24800,
      dealer_type: 'franchise' as const,
      location: {
        city: 'Beverly Hills',
        state: 'CA',
        zip: '90210',
        distance_miles: 6.8,
      },
      listing_date: '2024-12-17',
      days_on_market: 2,
      source: 'marketcheck' as const,
    },
    {
      vin: '1HGCM82633A012456',
      year: 2020,
      make: 'Honda',
      model: 'Civic',
      trim: 'Touring',
      miles: 35000,
      price: 23900,
      dealer_type: 'franchise' as const,
      location: {
        city: 'Culver City',
        state: 'CA',
        zip: '90230',
        distance_miles: 11.2,
      },
      listing_date: '2024-12-11',
      days_on_market: 8,
      source: 'marketcheck' as const,
    },
  ]

  return {
    success: true,
    data: {
      predictedPrice,
      priceRange: {
        min: Math.round(predictedPrice * 0.9),
        max: Math.round(predictedPrice * 1.1),
      },
      confidence: 'high',
      dataSource: 'marketcheck',
      requestParams: {
        vin,
        miles,
        zip: zipCode,
        dealer_type: 'franchise',
      },
      totalComparablesFound: 847,
      recentComparables: {
        num_found: mockListings.length,
        listings: mockListings,
        stats: undefined,
      },
      generatedAt: new Date().toISOString(),
    },
  }
}
