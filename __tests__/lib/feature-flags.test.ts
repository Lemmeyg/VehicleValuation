import { isEmailCaptureEnabled } from '@/lib/feature-flags'

describe('isEmailCaptureEnabled', () => {
  const original = process.env.NEXT_PUBLIC_ENABLE_FORM_EMAIL_CAPTURE

  afterEach(() => {
    if (original === undefined) {
      delete process.env.NEXT_PUBLIC_ENABLE_FORM_EMAIL_CAPTURE
    } else {
      process.env.NEXT_PUBLIC_ENABLE_FORM_EMAIL_CAPTURE = original
    }
  })

  it('returns true when env var is "true"', () => {
    process.env.NEXT_PUBLIC_ENABLE_FORM_EMAIL_CAPTURE = 'true'
    expect(isEmailCaptureEnabled()).toBe(true)
  })

  it('returns false when env var is unset', () => {
    delete process.env.NEXT_PUBLIC_ENABLE_FORM_EMAIL_CAPTURE
    expect(isEmailCaptureEnabled()).toBe(false)
  })

  it('returns false when env var is "false"', () => {
    process.env.NEXT_PUBLIC_ENABLE_FORM_EMAIL_CAPTURE = 'false'
    expect(isEmailCaptureEnabled()).toBe(false)
  })

  it('returns false when env var is "1"', () => {
    process.env.NEXT_PUBLIC_ENABLE_FORM_EMAIL_CAPTURE = '1'
    expect(isEmailCaptureEnabled()).toBe(false)
  })
})
