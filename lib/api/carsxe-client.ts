/**
 * CarsXE API Client
 *
 * Fetches market comparables and valuation data.
 */

export interface ComparableVehicle {
  vin?: string
  year: string
  make: string
  model: string
  trim?: string
  mileage: number
  price: number
  location?: string
  listingDate?: string
  source?: string
}

export interface MarketValuation {
  averageValue: number
  lowValue: number
  highValue: number
  confidence: 'low' | 'medium' | 'high'
  dataPoints: number
}

export interface CarsXEResponse {
  success: boolean
  data?: {
    vin: string
    valuation: MarketValuation
    comparables: ComparableVehicle[]
  }
  error?: string
}

/**
 * Fetch market data from CarsXE API
 *
 * @param vin - Vehicle Identification Number
 * @param vehicleData - Basic vehicle info (year, make, model) to help find comparables
 * @returns Market valuation and comparables
 */
export async function fetchCarsXEData(
  vin: string,
  vehicleData: { year: string; make: string; model: string; mileage?: number }
): Promise<CarsXEResponse> {
  const apiKey = process.env.CARSXE_API_KEY

  if (!apiKey) {
    return {
      success: false,
      error: 'CarsXE API key not configured',
    }
  }

  try {
    // CarsXE API endpoint (example - check actual documentation)
    const url = `https://api.carsxe.com/market?year=${vehicleData.year}&make=${vehicleData.make}&model=${vehicleData.model}`

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`CarsXE API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()

    return {
      success: true,
      data: {
        vin,
        valuation: data.valuation,
        comparables: data.listings || [],
      },
    }
  } catch (error) {
    console.error('CarsXE API error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Mock CarsXE data for development/testing
 */
export async function fetchCarsXEDataMock(
  vin: string,
  vehicleData: { year: string; make: string; model: string; mileage?: number }
): Promise<CarsXEResponse> {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 1500))

  // Calculate mock valuation based on vehicle data
  const baseValue = 18000
  const mileageAdjustment = vehicleData.mileage ? (75000 - vehicleData.mileage) * 0.1 : 0
  const averageValue = Math.round(baseValue + mileageAdjustment)

  return {
    success: true,
    data: {
      vin,
      valuation: {
        averageValue,
        lowValue: Math.round(averageValue * 0.85),
        highValue: Math.round(averageValue * 1.15),
        confidence: 'high',
        dataPoints: 127,
      },
      comparables: [
        {
          year: vehicleData.year,
          make: vehicleData.make,
          model: vehicleData.model,
          trim: 'EX',
          mileage: 42000,
          price: 19500,
          location: 'Los Angeles, CA',
          listingDate: '2024-11-20',
          source: 'CarGurus',
        },
        {
          year: vehicleData.year,
          make: vehicleData.make,
          model: vehicleData.model,
          trim: 'LX',
          mileage: 51000,
          price: 17800,
          location: 'San Diego, CA',
          listingDate: '2024-11-15',
          source: 'Autotrader',
        },
        {
          year: vehicleData.year,
          make: vehicleData.make,
          model: vehicleData.model,
          trim: 'EX-L',
          mileage: 38000,
          price: 20500,
          location: 'Sacramento, CA',
          listingDate: '2024-11-25',
          source: 'Cars.com',
        },
      ],
    },
  }
}
