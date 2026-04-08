// Jest mock for @/lib/db/supabase.
// Prevents real Supabase client initialisation (which requires env vars) during unit tests.

export const supabase = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn().mockResolvedValue({ data: null, error: null }),
  storage: {
    from: jest.fn().mockReturnThis(),
    upload: jest.fn().mockResolvedValue({ error: null }),
    createSignedUrl: jest
      .fn()
      .mockResolvedValue({ data: { signedUrl: 'https://mock.url' }, error: null }),
  },
}

export const supabaseAdmin = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn().mockResolvedValue({ data: null, error: null }),
  storage: {
    from: jest.fn().mockReturnThis(),
    upload: jest.fn().mockResolvedValue({ error: null }),
    createSignedUrl: jest
      .fn()
      .mockResolvedValue({ data: { signedUrl: 'https://mock.url' }, error: null }),
  },
}

export const createBrowserSupabaseClient = jest.fn(() => supabase)
export const createServerSupabaseClient = jest.fn(() => Promise.resolve(supabase))
export const createRouteHandlerSupabaseClient = jest.fn(() => Promise.resolve(supabase))
