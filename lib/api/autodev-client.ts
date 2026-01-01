/**
 * Auto.dev API Client
 *
 * Fetches accident and damage history from Auto.dev.
 * Also provides VIN decode functionality.
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

// =============================================
// ACCIDENT HISTORY INTERFACES
// =============================================

export interface AutoDevAccidentData {
  accidentDate?: string
  location?: string
  severity?: 'minor' | 'moderate' | 'severe'
  damageDescription?: string
  estimatedCost?: number
  repaired?: boolean
}

export interface AutoDevResponse {
  success: boolean
  data?: {
    vin: string
    hasAccidents: boolean
    accidents: AutoDevAccidentData[]
    totalAccidents: number
  }
  error?: string
}

// =============================================
// VIN DECODE INTERFACES
// =============================================

export interface AutoDevVinDecodeData {
  vin: string
  vinValid: boolean
  wmi: string
  checkDigit: string
  checksum: boolean
  origin: string
  make: string
  model: string
  trim: string
  style?: string
  body?: string
  type?: string
  engine?: string
  drive?: string
  transmission?: string
  ambiguous?: boolean
  vehicle: {
    vin: string
    year: number
    make: string
    model: string
    manufacturer: string
  }
}

export interface AutoDevVinDecodeResponse {
  success: boolean
  data?: AutoDevVinDecodeData
  error?: string
  statusCode?: number
}

/**
 * Fetch accident history from Auto.dev API
 *
 * @param vin - Vehicle Identification Number
 * @returns Accident history or error
 */
export async function fetchAutoDevData(vin: string): Promise<AutoDevResponse> {
  const apiKey = process.env.AUTODEV_API_KEY

  if (!apiKey) {
    return {
      success: false,
      error: 'Auto.dev API key not configured',
    }
  }

  try {
    // Auto.dev API endpoint (example - check actual documentation)
    const url = `https://auto.dev/api/vin/${vin}/history`

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`Auto.dev API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()

    return {
      success: true,
      data: {
        vin: data.vin || vin,
        hasAccidents: data.accident_count > 0,
        accidents: data.accidents || [],
        totalAccidents: data.accident_count || 0,
      },
    }
  } catch (error) {
    console.error('Auto.dev API error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Mock Auto.dev data for development/testing
 */
export async function fetchAutoDevDataMock(vin: string): Promise<AutoDevResponse> {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 1200))

  // Return mock data
  return {
    success: true,
    data: {
      vin,
      hasAccidents: true,
      totalAccidents: 1,
      accidents: [
        {
          accidentDate: '2023-06-15',
          location: 'Los Angeles, CA',
          severity: 'moderate',
          damageDescription: 'Front-end collision. Damage to bumper, hood, and right fender.',
          estimatedCost: 4500,
          repaired: true,
        },
      ],
    },
  }
}

// =============================================
// VIN DECODE API FUNCTIONS
// =============================================

/**
 * Fetch VIN decode data from Auto.dev API with retry logic
 *
 * @param vin - Vehicle Identification Number (17 characters)
 * @param retryConfig - Retry configuration (optional)
 * @returns VIN decode data or error
 */
export async function fetchAutoDevVinDecode(
  vin: string,
  retryConfig: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<AutoDevVinDecodeResponse> {
  const apiKey = process.env.AUTODEV_API_KEY

  if (!apiKey) {
    return {
      success: false,
      error: 'Auto.dev API key not configured',
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

  // Retry loop
  let lastError: Error | null = null
  const startTime = Date.now()

  for (let attempt = 1; attempt <= retryConfig.maxAttempts; attempt++) {
    try {
      console.log(`[AutoDev VIN] Attempt ${attempt}/${retryConfig.maxAttempts}`, { vin })

      const url = `https://api.auto.dev/vin/${vin}`

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(30000), // 30 second timeout
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('[AutoDev VIN] API error:', {
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
            error: `Auto.dev API error: ${response.status} ${response.statusText}`,
            statusCode: response.status,
          }
        }

        // Retry on server errors or rate limits
        const backoffDelay = calculateBackoffDelay(attempt, retryConfig)
        console.log(`[AutoDev VIN] Retrying after ${backoffDelay}ms...`)
        await sleep(backoffDelay)
        continue
      }

      const data = await response.json()
      const responseTime = Date.now() - startTime

      console.log('[AutoDev VIN] Success', {
        attempt,
        responseTimeMs: responseTime,
        make: data.make,
        model: data.model,
        year: data.vehicle?.year,
      })

      return {
        success: true,
        data: {
          vin: data.vin,
          vinValid: data.vinValid,
          wmi: data.wmi,
          checkDigit: data.checkDigit,
          checksum: data.checksum,
          origin: data.origin,
          make: data.make,
          model: data.model,
          trim: data.trim,
          style: data.style,
          body: data.body,
          type: data.type,
          engine: data.engine,
          drive: data.drive,
          transmission: data.transmission,
          ambiguous: data.ambiguous,
          vehicle: data.vehicle,
        },
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error')
      console.error(`[AutoDev VIN] Exception on attempt ${attempt}:`, lastError)

      if (attempt === retryConfig.maxAttempts) {
        break
      }

      const backoffDelay = calculateBackoffDelay(attempt, retryConfig)
      console.log(`[AutoDev VIN] Retrying after ${backoffDelay}ms...`)
      await sleep(backoffDelay)
    }
  }

  // All retries exhausted
  return {
    success: false,
    error: lastError?.message || 'Auto.dev VIN decode failed after retries',
    statusCode: 500,
  }
}

/**
 * Mock Auto.dev VIN Decode data for development/testing
 */
export async function fetchAutoDevVinDecodeMock(
  vin: string
): Promise<AutoDevVinDecodeResponse> {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 1500))

  return {
    success: true,
    data: {
      vin,
      vinValid: true,
      wmi: vin.substring(0, 3),
      checkDigit: vin.charAt(8),
      checksum: true,
      origin: 'United States',
      make: 'Honda',
      model: 'Civic',
      trim: 'EX',
      style: '4dr Sedan',
      body: 'Sedan',
      type: 'Passenger Car',
      engine: '2.0L I4 DOHC 16V',
      drive: 'FWD',
      transmission: 'CVT',
      ambiguous: false,
      vehicle: {
        vin,
        year: 2020,
        make: 'Honda',
        model: 'Civic',
        manufacturer: 'Honda Motor Company',
      },
    },
  }
}
