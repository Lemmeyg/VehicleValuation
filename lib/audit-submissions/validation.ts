import { z } from 'zod'

export const MAX_FILE_SIZE_BYTES = 3 * 1024 * 1024

export const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'] as const
export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number]

export function isAllowedMimeType(mimeType: string): mimeType is AllowedMimeType {
  return (ALLOWED_MIME_TYPES as readonly string[]).includes(mimeType)
}

export const auditSubmissionSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  note: z.string().trim().max(2000).optional(),
  consentAck: z.literal(true),
})
