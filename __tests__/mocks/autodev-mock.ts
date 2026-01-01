/**
 * Auto.dev API Mock
 *
 * Provides realistic mock data for Auto.dev API calls
 * CRITICAL: Prevents usage of limited free tier (1000/month) during tests
 */

export const mockAutoDevVinDecodeSuccess = {
  success: true,
  data: {
    vin: '1HGBH41JXMN109186',
    year: 2021,
    make: 'Honda',
    model: 'Accord',
    trim: 'EX-L',
    body_style: 'Sedan',
    engine: '1.5L Turbo I4',
    transmission: 'CVT',
    drivetrain: 'FWD',
    fuel_type: 'Gasoline',
    doors: 4,
    manufactured_in: 'United States',
  },
}

export const mockAutoDevVinDecodeError = {
  success: false,
  error: 'Invalid VIN format',
}

export const mockAutoDevAccidentHistorySuccess = {
  success: true,
  data: {
    total_accidents: 0,
    total_damage_events: 0,
    accidents: [],
    airbag_deployments: 0,
    structural_damage: false,
    frame_damage: false,
    odometer_rollback: false,
    salvage_title: false,
    theft_record: false,
  },
}

export const mockAutoDevAccidentHistoryWithAccidents = {
  success: true,
  data: {
    total_accidents: 2,
    total_damage_events: 2,
    accidents: [
      {
        date: '2022-05-15',
        type: 'collision',
        severity: 'minor',
        damage_location: 'front',
        estimated_damage: 3500,
        airbag_deployed: false,
      },
      {
        date: '2023-08-20',
        type: 'collision',
        severity: 'moderate',
        damage_location: 'rear',
        estimated_damage: 7200,
        airbag_deployed: false,
      },
    ],
    airbag_deployments: 0,
    structural_damage: false,
    frame_damage: false,
    odometer_rollback: false,
    salvage_title: false,
    theft_record: false,
  },
}

/**
 * Mock implementation of Auto.dev client
 */
export function createMockAutoDevClient() {
  return {
    fetchAutoDevVinDecode: jest.fn().mockResolvedValue(mockAutoDevVinDecodeSuccess),
    fetchAutoDevAccidentHistory: jest.fn().mockResolvedValue(mockAutoDevAccidentHistorySuccess),
  }
}
