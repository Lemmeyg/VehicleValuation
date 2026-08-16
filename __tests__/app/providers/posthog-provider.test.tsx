/**
 * Tests for PostHogProvider
 *
 * Verifies that PostHog is NOT initialised on Vercel preview deployments so
 * preview traffic doesn't pollute production analytics, that autocapture is not
 * url_allowlist-restricted, that exception capture is on (BL-127), and that init
 * happens at module evaluation rather than in an effect (BL-128).
 *
 * Because init now runs at module scope, each case re-evaluates the module with
 * the env it wants via jest.resetModules() instead of relying on render().
 */

import { render } from '@testing-library/react'

jest.mock('posthog-js', () => ({
  __loaded: false,
  init: jest.fn(),
}))

jest.mock('posthog-js/react', () => ({
  PostHogProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

const ORIGINAL_ENV = process.env

type PosthogMock = { __loaded: boolean; init: jest.Mock }

/**
 * Re-evaluate the provider module under the current process.env and return the
 * fresh posthog mock it initialised against.
 */
function loadProvider(): { posthog: PosthogMock; module: typeof import('@/app/providers/posthog-provider') } {
  let posthog!: PosthogMock
  let mod!: typeof import('@/app/providers/posthog-provider')

  jest.resetModules()
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  posthog = require('posthog-js') as PosthogMock
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  mod = require('@/app/providers/posthog-provider')

  return { posthog, module: mod }
}

beforeEach(() => {
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

    const { posthog } = loadProvider()

    expect(posthog.init).not.toHaveBeenCalled()
  })

  it('initialises PostHog when NEXT_PUBLIC_VERCEL_ENV is "production"', () => {
    process.env.NEXT_PUBLIC_VERCEL_ENV = 'production'

    const { posthog } = loadProvider()

    expect(posthog.init).toHaveBeenCalledWith(
      'phc_test',
      expect.objectContaining({ api_host: 'https://app.posthog.com' })
    )
  })

  it('initialises PostHog when NEXT_PUBLIC_VERCEL_ENV is not set (local dev)', () => {
    delete process.env.NEXT_PUBLIC_VERCEL_ENV

    const { posthog } = loadProvider()

    expect(posthog.init).toHaveBeenCalled()
  })

  it('does not initialise PostHog when it is disabled or misconfigured', () => {
    process.env.NEXT_PUBLIC_POSTHOG_ENABLED = 'false'

    const { posthog } = loadProvider()

    expect(posthog.init).not.toHaveBeenCalled()
  })
})

describe('PostHogProvider — autocapture config', () => {
  it('does not restrict autocapture to a url_allowlist, so it runs on every production URL', () => {
    process.env.NEXT_PUBLIC_VERCEL_ENV = 'production'

    const { posthog } = loadProvider()

    const [, options] = posthog.init.mock.calls[0] as [
      string,
      { autocapture: Record<string, unknown> },
    ]
    expect(options.autocapture).not.toHaveProperty('url_allowlist')
    expect(options.autocapture.dom_event_allowlist).toEqual(['click', 'change', 'submit'])
    expect(options.autocapture.element_allowlist).toEqual([
      'a',
      'button',
      'form',
      'input',
      'select',
      'textarea',
    ])
  })
})

// BL-127: the error dashboard was empty because posthog-js never reported
// exceptions — capture_exceptions is off by default.
describe('PostHogProvider — exception capture (BL-127)', () => {
  it('enables capture_exceptions so unhandled errors reach error tracking', () => {
    const { posthog } = loadProvider()

    expect(posthog.init).toHaveBeenCalledWith(
      'phc_test',
      expect.objectContaining({ capture_exceptions: true })
    )
  })
})

// BL-128: init used to live in the provider's useEffect. React runs child
// effects before parent effects, so trackers capturing from a mount effect ran
// while posthog.__loaded was false and their events were silently dropped.
describe('PostHogProvider — init ordering (BL-128)', () => {
  it('initialises on module evaluation, before any component renders or effects run', () => {
    const { posthog } = loadProvider()

    // Already initialised purely from importing the module — no render() yet.
    expect(posthog.init).toHaveBeenCalledTimes(1)
  })

  it('does not re-initialise when the provider renders', () => {
    const { posthog, module } = loadProvider()
    expect(posthog.init).toHaveBeenCalledTimes(1)

    render(<module.PostHogProvider>child</module.PostHogProvider>)

    expect(posthog.init).toHaveBeenCalledTimes(1)
  })

  it('does not re-initialise if PostHog is already loaded', () => {
    process.env.NEXT_PUBLIC_VERCEL_ENV = 'production'

    jest.resetModules()
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const posthog = require('posthog-js') as PosthogMock
    posthog.__loaded = true
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@/app/providers/posthog-provider')

    expect(posthog.init).not.toHaveBeenCalled()
  })

  it('still renders its children', () => {
    const { module } = loadProvider()

    const { getByText } = render(<module.PostHogProvider>hello</module.PostHogProvider>)

    expect(getByText('hello')).toBeInTheDocument()
  })
})
