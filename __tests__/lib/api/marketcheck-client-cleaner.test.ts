/**
 * @jest-environment node
 */

jest.mock('@/lib/utils/comparables-cleaner', () => ({
  cleanAndFilterComparables: jest.fn(listings => listings),
  MAX_DEALER_LISTINGS: 3,
}))

// marketcheck-client now imports the api-call-logger (for fallback-search observability),
// which pulls in the Supabase client at module load. Stub it so this suite stays isolated.
jest.mock('@/lib/api/api-call-logger', () => ({
  logApiCall: jest.fn().mockResolvedValue(undefined),
  logSupplementOutcome: jest.fn().mockResolvedValue(undefined),
}))

import { cleanAndFilterComparables } from '@/lib/utils/comparables-cleaner'
import { fetchMarketCheckData } from '@/lib/api/marketcheck-client'

const mockClean = cleanAndFilterComparables as jest.MockedFunction<typeof cleanAndFilterComparables>

const VALID_VIN = 'JM3KFBBM4L0818961'
const VALID_ZIP = '65804'

const fakeNewCarListing = {
  id: 'abc-123',
  vin: 'NEW0000000000001',
  year: 2026,
  make: 'Mazda',
  model: 'CX-5',
  trim: 'S Premium Plus',
  miles: 0,
  price: 43000,
  dom: 10,
  dom_180: 10,
  dom_active: 10,
  dos_active: 10,
  dealer_type: 'independent',
  dealer_name: 'Heritage Mazda Towson',
  vdp_url: 'https://example.com',
  photo_url: 'https://example.com/photo.jpg',
  first_seen_at: '2026-04-01T00:00:00.000Z',
  source: 'marketcheck',
}

const fakeApiResponse = {
  marketcheck_price: 17389,
  price_range: { min: 15650, max: 19128 },
  confidence: 'medium',
  comparables: {
    num_found: 17,
    stats: { price: { mean: 20000 } },
  },
  recent_comparables: {
    num_found: 50,
    listings: Array.from({ length: 50 }, (_, i) => ({
      ...fakeNewCarListing,
      id: `abc-${i}`,
      vin: `NEW000000000${String(i).padStart(4, '0')}`,
    })),
    stats: {},
  },
}

beforeEach(() => {
  jest.clearAllMocks()
  mockClean.mockImplementation(listings => listings)
  process.env.MARKETCHECK_API_KEY = 'test-key'
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(fakeApiResponse),
  } as unknown as Response)
})

afterEach(() => {
  delete process.env.MARKETCHECK_API_KEY
})

it('calls cleanAndFilterComparables with the mapped listings and subject year', async () => {
  await fetchMarketCheckData(VALID_VIN, 88650, VALID_ZIP, false, undefined, {
    year: 2020,
    make: 'Mazda',
    model: 'CX-5',
  })

  expect(mockClean).toHaveBeenCalledTimes(1)
  const [passedListings, passedYear] = mockClean.mock.calls[0]
  expect(passedListings).toHaveLength(50)
  expect(passedYear).toBe(2020)
})

it('calls cleanAndFilterComparables with undefined year when subjectVehicle has no year', async () => {
  await fetchMarketCheckData(VALID_VIN, 88650, VALID_ZIP, false, undefined, {
    make: 'Mazda',
    model: 'CX-5',
  })

  expect(mockClean).toHaveBeenCalledTimes(1)
  const [, passedYear] = mockClean.mock.calls[0]
  expect(passedYear).toBeUndefined()
})
