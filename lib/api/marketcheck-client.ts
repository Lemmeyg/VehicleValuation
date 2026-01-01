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
 * - Stores ALL listings from recent_comparables without filtering
 * - No make/model/trim filtering applied (removed to maximize data capture)
 * - Filtering happens on frontend using lib/utils/listing-filters.ts
 * - Sorted by price (highest first) for consistency
 *
 * @see https://docs.marketcheck.com/docs/api/cars/market-insights/marketcheck-price
 */

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
  listing_date?: string
  mc_website_id?: number
  source: string
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
    dealer_type: 'franchise' | 'independent'
  }

  // Total comparables found (metadata only - listings not stored)
  totalComparablesFound: number

  // Statistical analysis from ALL comparables (Premium API)
  comparablesStats?: ComparableStats

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
}

/**
 * Fetch price prediction from MarketCheck API with retry logic
 *
 * @param vin - Vehicle Identification Number (17 characters)
 * @param miles - Current mileage
 * @param zipCode - ZIP code for location-based pricing
 * @param isCertified - Whether vehicle is certified pre-owned (default: false)
 * @param retryConfig - Retry configuration (optional)
 * @param subjectVehicle - NOT USED - kept for backward compatibility only
 * @returns Price prediction with ALL comparables (no filtering)
 *
 * NOTE: All listings from recent_comparables are stored without filtering.
 *       Filtering happens on the frontend for maximum flexibility.
 */
export async function fetchMarketCheckData(
  vin: string,
  miles: number,
  zipCode: string,
  isCertified: boolean = false,
  retryConfig: RetryConfig = DEFAULT_RETRY_CONFIG,
  subjectVehicle?: {
    make?: string
    model?: string
    trim?: string
  }
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
      console.log(`[MarketCheck] Attempt ${attempt}/${retryConfig.maxAttempts}`, {
        vin,
        miles,
        zipCode,
      })

      // CORRECTED ENDPOINT: /comparables for premium service
      const url = new URL('https://api.marketcheck.com/v2/predict/car/us/marketcheck_price/comparables')
      url.searchParams.append('api_key', apiKey)
      url.searchParams.append('vin', vin)
      url.searchParams.append('miles', miles.toString())
      url.searchParams.append('zip', zipCode) // Changed from 'location'
      url.searchParams.append('dealer_type', 'franchise') // HARDCODED: franchise per user requirement
      url.searchParams.append('is_certified', isCertified ? 'true' : 'false')

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

      // TEMPORARY DEBUG: Log full API response to understand structure
      console.log('[MarketCheck] FULL API RESPONSE:', JSON.stringify(data, null, 2))

      // CRITICAL DEBUG: Check what's in recent_comparables
      if (data.recent_comparables) {
        console.log('[MarketCheck] recent_comparables STRUCTURE:', {
          hasRecentComparables: !!data.recent_comparables,
          num_found: data.recent_comparables.num_found,
          hasListings: !!data.recent_comparables.listings,
          listingsIsArray: Array.isArray(data.recent_comparables.listings),
          listingsLength: data.recent_comparables.listings?.length,
          listingsKeys: data.recent_comparables.listings ? 'array' : Object.keys(data.recent_comparables),
          firstListingKeys: data.recent_comparables.listings?.[0] ? Object.keys(data.recent_comparables.listings[0]) : 'none',
        })
      } else {
        console.log('[MarketCheck] WARNING: No recent_comparables in API response')
      }

      // Check if listings might be in a different location
      console.log('[MarketCheck] API Response Top-Level Keys:', Object.keys(data))

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
          dealer_type: 'franchise', // HARDCODED: franchise per user requirement
        },

        // Total comparables found (metadata only - listings NOT stored)
        totalComparablesFound: data.comparables?.num_found || data.total_listings || data.total || 0,

        // Statistical analysis from ALL comparables (Premium API)
        // IMPORTANT: These stats are from the full comparables dataset
        comparablesStats: data.comparables?.stats,

        // Recent comparables (Premium API - actual sales data)
        // IMPORTANT: Store ALL listings - filtering happens on frontend
        recentComparables: data.recent_comparables
          ? {
              num_found: data.recent_comparables.num_found || 0,
              listings:
                ((data.recent_comparables.listings || []) as any[])
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
                    location: listing.dealer_address || listing.location
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
                    vdp_url: listing.vdp_url, // Vehicle Details Page URL
                    dealer_name: listing.dealer_name,
                  }))
                  // NO FILTERING - Store ALL listings exactly as API returns them
                  // Filtering happens on frontend for maximum flexibility
                  // Sort by price descending (highest first)
                  .sort((a, b) => b.price - a.price),
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
