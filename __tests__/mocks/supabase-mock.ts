/**
 * Supabase Client Mock
 *
 * Provides mock implementation of Supabase client for tests
 * Prevents real database calls during testing
 */

export const mockUser = {
  id: 'test-user-id-123',
  email: 'test@example.com',
  user_metadata: {
    full_name: 'Test User',
  },
  created_at: '2024-01-01T00:00:00Z',
}

export const mockAdmin = {
  id: 'test-admin-id-456',
  email: 'admin@example.com',
  user_metadata: {
    full_name: 'Test Admin',
  },
  created_at: '2024-01-01T00:00:00Z',
}

export const mockReport = {
  id: 'test-report-id-789',
  user_id: 'test-user-id-123',
  vin: '1HGBH41JXMN109186',
  mileage: 35000,
  zip_code: '10001',
  report_type: 'premium',
  status: 'pending',
  price_paid: 49.00,
  lemon_squeezy_payment_id: 'ls-order-123',
  vehicle_data: {
    year: 2021,
    make: 'Honda',
    model: 'Accord',
    trim: 'EX-L',
  },
  created_at: '2024-01-01T00:00:00Z',
}

/**
 * Create a mock Supabase client
 */
export function createMockSupabaseClient() {
  const mockFrom = jest.fn((table: string) => ({
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: null, error: null }),
  }))

  return {
    from: mockFrom,
    auth: {
      signUp: jest.fn().mockResolvedValue({ data: { user: mockUser, session: null }, error: null }),
      signInWithPassword: jest.fn().mockResolvedValue({ data: { user: mockUser, session: null }, error: null }),
      signInWithOtp: jest.fn().mockResolvedValue({ data: {}, error: null }),
      signOut: jest.fn().mockResolvedValue({ error: null }),
      getUser: jest.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
    },
  }
}

/**
 * Create a mock Supabase admin client (service role)
 */
export function createMockSupabaseAdmin() {
  return {
    ...createMockSupabaseClient(),
    // Admin client has full access
  }
}
