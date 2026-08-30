import { describe, it, expect, beforeEach } from '@jest/globals'
// `jest` is the global (not the @jest/globals export) so `jest.mock` below is
// hoisted above the imports. Bare `jest.mock('@/lib/db/supabase')` picks up the
// manual mock at lib/db/__mocks__/supabase.ts, where `supabase.from` is a jest
// mock fn. (`lib/markdown` no longer needs mocking — it loads its ESM pipeline
// lazily now, so importing `suppliers-db` doesn't drag `unified` in.)
jest.mock('@/lib/db/supabase')

import { supabase } from '@/lib/db/supabase'
import { getStateDirectorySuppliers } from '@/lib/suppliers-db'

const mockSupabase = supabase as jest.Mocked<typeof supabase>

function buildChain(resolvedValue: { data: unknown[] | null; error: unknown }) {
  const chain = {
    select: jest.fn(),
    eq: jest.fn(),
    in: jest.fn(),
    order: jest.fn(),
    limit: jest.fn().mockResolvedValue(resolvedValue),
  }
  chain.select.mockReturnValue(chain)
  chain.eq.mockReturnValue(chain)
  chain.in.mockReturnValue(chain)
  chain.order.mockReturnValue(chain)
  return chain
}

describe('getStateDirectorySuppliers', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns an empty array when no suppliers exist', async () => {
    mockSupabase.from.mockReturnValue(buildChain({ data: [], error: null }) as never)
    const result = await getStateDirectorySuppliers('Indiana')
    expect(result).toEqual([])
  })

  it('returns an empty array on Supabase error', async () => {
    mockSupabase.from.mockReturnValue(
      buildChain({ data: null, error: { message: 'DB error' } }) as never
    )
    const result = await getStateDirectorySuppliers('Indiana')
    expect(result).toEqual([])
  })

  it('returns mapped supplier rows when data exists', async () => {
    const mockRow = {
      slug: 'test-appraiser',
      business_name: 'Acme Appraisals',
      contact_name: 'Jane Doe',
      contact_email: 'jane@acme.com',
      contact_phone: '555-1234',
      website_url: 'https://acme.com',
      city: 'Indianapolis',
      state: 'Indiana',
      zip_code: '46201',
      service_type: 'appraiser',
      specialties: ['total_loss'],
      value_proposition: 'Fast and fair',
      years_in_business: 10,
      certifications: [],
      insurance_accepted: [],
      featured: true,
      verified: true,
      published: true,
      content: '',
    }
    mockSupabase.from.mockReturnValue(buildChain({ data: [mockRow], error: null }) as never)
    const result = await getStateDirectorySuppliers('Indiana')
    expect(result).toHaveLength(1)
    expect(result[0].businessName).toBe('Acme Appraisals')
    expect(result[0].state).toBe('Indiana')
  })
})
