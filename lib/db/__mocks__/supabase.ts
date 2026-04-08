// Jest automatic mock for lib/db/supabase.
// Located at lib/db/__mocks__/supabase.ts — Jest resolves this automatically
// when jest.mock('@/lib/db/supabase') is called in test files.

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
