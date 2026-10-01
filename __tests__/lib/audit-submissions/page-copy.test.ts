/**
 * @jest-environment node
 */
const mockEvaluateFlags = jest.fn()
const mockShutdown = jest.fn().mockResolvedValue(undefined)

jest.mock('posthog-node', () => ({
  PostHog: jest.fn().mockImplementation(() => ({
    evaluateFlags: mockEvaluateFlags,
    shutdown: mockShutdown,
  })),
}))

import {
  getCompsCheckCopy,
  parseCopyPayload,
  DEFAULT_COMPS_CHECK_COPY,
  COMPS_CHECK_COPY_FLAG,
} from '@/lib/audit-submissions/page-copy'

const VALID = {
  version: 'v2-2026-10-15',
  headline: 'Did your insurer lowball your car?',
  subheadline: 'Send us their valuation report and a person will check it for free.',
  submitLabel: 'Check my report',
  trustLine: 'Free. Read by a person. Deleted within 90 days.',
}

describe('parseCopyPayload', () => {
  it('accepts a valid object payload', () => {
    expect(parseCopyPayload(VALID)).toEqual(VALID)
  })

  it('accepts a JSON-string payload and defaults a missing trust line to null', () => {
    const rest = { ...VALID } as Partial<typeof VALID>
    delete rest.trustLine
    expect(parseCopyPayload(JSON.stringify(rest))).toEqual({ ...rest, trustLine: null })
  })

  it('falls back to the default copy for missing, malformed or out-of-bounds payloads', () => {
    expect(parseCopyPayload(undefined)).toBe(DEFAULT_COMPS_CHECK_COPY)
    expect(parseCopyPayload('{not json')).toBe(DEFAULT_COMPS_CHECK_COPY)
    expect(parseCopyPayload({ ...VALID, headline: '' })).toBe(DEFAULT_COMPS_CHECK_COPY)
    expect(parseCopyPayload({ ...VALID, submitLabel: 'x'.repeat(41) })).toBe(
      DEFAULT_COMPS_CHECK_COPY
    )
    expect(parseCopyPayload({ ...VALID, version: 'has spaces' })).toBe(DEFAULT_COMPS_CHECK_COPY)
  })
})

describe('getCompsCheckCopy', () => {
  const origKey = process.env.NEXT_PUBLIC_POSTHOG_KEY

  beforeEach(() => {
    jest.clearAllMocks()
    process.env.NEXT_PUBLIC_POSTHOG_KEY = 'phc_test'
  })

  afterAll(() => {
    if (origKey === undefined) delete process.env.NEXT_PUBLIC_POSTHOG_KEY
    else process.env.NEXT_PUBLIC_POSTHOG_KEY = origKey
  })

  it('returns the flag payload copy and asks only for its own flag', async () => {
    mockEvaluateFlags.mockResolvedValue({ getFlagPayload: () => VALID })
    await expect(getCompsCheckCopy()).resolves.toEqual(VALID)
    expect(mockEvaluateFlags).toHaveBeenCalledWith(expect.any(String), {
      flagKeys: [COMPS_CHECK_COPY_FLAG],
    })
    expect(mockShutdown).toHaveBeenCalled()
  })

  it('falls back to the default copy when PostHog errors or times out', async () => {
    mockEvaluateFlags.mockRejectedValue(new Error('timeout'))
    jest.spyOn(console, 'error').mockImplementation(() => {})
    await expect(getCompsCheckCopy()).resolves.toBe(DEFAULT_COMPS_CHECK_COPY)
  })

  it('falls back to the default copy when no PostHog key is configured', async () => {
    delete process.env.NEXT_PUBLIC_POSTHOG_KEY
    await expect(getCompsCheckCopy()).resolves.toBe(DEFAULT_COMPS_CHECK_COPY)
    expect(mockEvaluateFlags).not.toHaveBeenCalled()
  })
})
