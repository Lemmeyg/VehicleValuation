/**
 * Tests for PostHogProvider
 *
 * Verifies that PostHog is NOT initialised on Vercel preview deployments
 * so preview traffic doesn't pollute production analytics.
 */

import { render } from '@testing-library/react'
import posthog from 'posthog-js'
import { PostHogProvider } from '@/app/providers/posthog-provider'

jest.mock('posthog-js', () => ({
  __loaded: false,
  init: jest.fn(),
}))

jest.mock('posthog-js/react', () => ({
  PostHogProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

const mockPosthog = posthog as jest.Mocked<typeof posthog>
const ORIGINAL_ENV = process.env

beforeEach(() => {
  jest.clearAllMocks()
  process.env = {
    ...ORIGINAL_ENV,
    NEXT_PUBLIC_POSTHOG_KEY: 'phc_test',
    NEXT_PUBLIC_POSTHOG_HOST: 'https://app.posthog.com',
    NEXT_PUBLIC_POSTHOG_ENABLED: 'true',
  }
})

afterEach(() => {
  process.env = ORIGINAL_ENV
})

describe('PostHogProvider — Vercel preview filter', () => {
  it('does not initialise PostHog when NEXT_PUBLIC_VERCEL_ENV is "preview"', () => {
    process.env.NEXT_PUBLIC_VERCEL_ENV = 'preview'

    render(<PostHogProvider>child</PostHogProvider>)

    expect(mockPosthog.init).not.toHaveBeenCalled()
  })

  it('initialises PostHog when NEXT_PUBLIC_VERCEL_ENV is "production"', () => {
    process.env.NEXT_PUBLIC_VERCEL_ENV = 'production'

    render(<PostHogProvider>child</PostHogProvider>)

    expect(mockPosthog.init).toHaveBeenCalledWith(
      'phc_test',
      expect.objectContaining({ api_host: 'https://app.posthog.com' })
    )
  })

  it('initialises PostHog when NEXT_PUBLIC_VERCEL_ENV is not set (local dev)', () => {
    delete process.env.NEXT_PUBLIC_VERCEL_ENV

    render(<PostHogProvider>child</PostHogProvider>)

    expect(mockPosthog.init).toHaveBeenCalled()
  })
})
