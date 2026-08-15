/**
 * @jest-environment node
 *
 * BL-125: the emailed PDF link is fetched straight from our server, so no
 * browser code of ours runs and posthog-js can never see it. These tests cover
 * the server-side capture that fills that blind spot.
 */
const mockCapture = jest.fn()
const mockShutdown = jest.fn().mockResolvedValue(undefined)

jest.mock('posthog-node', () => ({
  PostHog: jest.fn().mockImplementation(() => ({
    capture: mockCapture,
    shutdown: mockShutdown,
  })),
}))

import { captureReportDownloaded, isLikelyBotUserAgent } from '@/lib/analytics/server-events'

const ORIGINAL_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY

beforeEach(() => {
  jest.clearAllMocks()
  jest.resetModules()
  process.env.NEXT_PUBLIC_POSTHOG_KEY = 'phc_test_key'
})

afterEach(() => {
  if (ORIGINAL_KEY === undefined) delete process.env.NEXT_PUBLIC_POSTHOG_KEY
  else process.env.NEXT_PUBLIC_POSTHOG_KEY = ORIGINAL_KEY
})

describe('captureReportDownloaded', () => {
  it('attributes the download to the buyer stored PostHog id', async () => {
    await captureReportDownloaded({
      reportId: 'report-abc',
      distinctId: 'ph-distinct-1',
    })

    expect(mockCapture).toHaveBeenCalledWith(
      expect.objectContaining({
        distinctId: 'ph-distinct-1',
        event: 'report_downloaded',
        properties: expect.objectContaining({
          format: 'pdf',
          source: 'email_link',
          reportId: 'report-abc',
        }),
      })
    )
  })

  it('falls back to a report-scoped id when no PostHog id was stored', async () => {
    await captureReportDownloaded({ reportId: 'report-abc', distinctId: null })

    expect(mockCapture).toHaveBeenCalledWith(
      expect.objectContaining({ distinctId: 'report:report-abc' })
    )
  })

  it('marks the event as unattributed when no PostHog id was stored', async () => {
    await captureReportDownloaded({ reportId: 'report-abc', distinctId: null })

    expect(mockCapture).toHaveBeenCalledWith(
      expect.objectContaining({
        properties: expect.objectContaining({ attributed: false }),
      })
    )
  })

  it('marks the event as attributed when a PostHog id was stored', async () => {
    await captureReportDownloaded({ reportId: 'report-abc', distinctId: 'ph-1' })

    expect(mockCapture).toHaveBeenCalledWith(
      expect.objectContaining({
        properties: expect.objectContaining({ attributed: true }),
      })
    )
  })

  it('does nothing and does not throw when PostHog is not configured', async () => {
    delete process.env.NEXT_PUBLIC_POSTHOG_KEY

    await expect(
      captureReportDownloaded({ reportId: 'report-abc', distinctId: 'ph-1' })
    ).resolves.toBeUndefined()
    expect(mockCapture).not.toHaveBeenCalled()
  })
})

describe('isLikelyBotUserAgent', () => {
  // Corporate mail scanners follow links to check them for malware. Counting
  // those as customer downloads would inflate the funnel's final stage.
  it.each([
    'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    'Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)',
    'Microsoft Office Existence Discovery',
    'curl/8.4.0',
    'python-requests/2.31.0',
  ])('flags %s as a bot', ua => {
    expect(isLikelyBotUserAgent(ua)).toBe(true)
  })

  it('does not flag a real browser', () => {
    expect(
      isLikelyBotUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
      )
    ).toBe(false)
  })

  it('does not flag a missing user agent as a bot', () => {
    expect(isLikelyBotUserAgent(null)).toBe(false)
  })
})
