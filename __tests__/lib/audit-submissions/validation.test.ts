import {
  auditSubmissionSchema,
  isAllowedMimeType,
  MAX_FILE_SIZE_BYTES,
} from '@/lib/audit-submissions/validation'

describe('isAllowedMimeType', () => {
  it('accepts pdf, jpeg, and png', () => {
    expect(isAllowedMimeType('application/pdf')).toBe(true)
    expect(isAllowedMimeType('image/jpeg')).toBe(true)
    expect(isAllowedMimeType('image/png')).toBe(true)
  })

  it('rejects anything else', () => {
    expect(isAllowedMimeType('application/zip')).toBe(false)
    expect(isAllowedMimeType('image/gif')).toBe(false)
    expect(isAllowedMimeType('')).toBe(false)
  })
})

describe('MAX_FILE_SIZE_BYTES', () => {
  it('is 2MB', () => {
    expect(MAX_FILE_SIZE_BYTES).toBe(2 * 1024 * 1024)
  })
})

describe('auditSubmissionSchema', () => {
  it('accepts a valid submission', () => {
    const result = auditSubmissionSchema.safeParse({
      email: 'user@example.com',
      note: 'Here is my report',
      consentAck: true,
    })
    expect(result.success).toBe(true)
  })

  it('accepts a submission with no note', () => {
    const result = auditSubmissionSchema.safeParse({
      email: 'user@example.com',
      consentAck: true,
    })
    expect(result.success).toBe(true)
  })

  it('lowercases and trims the email', () => {
    const result = auditSubmissionSchema.safeParse({
      email: '  USER@Example.com  ',
      consentAck: true,
    })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.email).toBe('user@example.com')
  })

  it('rejects an invalid email', () => {
    const result = auditSubmissionSchema.safeParse({ email: 'not-an-email', consentAck: true })
    expect(result.success).toBe(false)
  })

  it('rejects consentAck: false', () => {
    const result = auditSubmissionSchema.safeParse({ email: 'user@example.com', consentAck: false })
    expect(result.success).toBe(false)
  })

  it('rejects a note over 2000 characters', () => {
    const result = auditSubmissionSchema.safeParse({
      email: 'user@example.com',
      note: 'a'.repeat(2001),
      consentAck: true,
    })
    expect(result.success).toBe(false)
  })
})
