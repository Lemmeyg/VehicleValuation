# Purchase Confirmation Email (ZeptoMail) Implementation Plan

> **Superseded 2026-07-22:** never built. Replaced by the Zoho Campaigns report-delivery automation — a link to the report was chosen over a PDF attachment for email deliverability and customer experience. See `docs/superpowers/specs/2026-07-22-report-delivery-zoho-automation-design.md` in the `totallosstoolkit-workspace` repo.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Send every buyer a confirmation email with their report PDF attached, immediately after purchase, via Zoho ZeptoMail — giving them an independent copy of what they paid for that survives even if the on-site session or auth flow breaks. Implements N1 from `docs/superpowers/specs/2026-07-07-post-payment-ideal-experience-design.md`.

**Architecture:** `lib/services/pdf-generator.tsx`'s `generateAndUploadPDF()` is extended to return the already-rendered PDF buffer alongside the upload it already performs, so the email step never re-renders the PDF. A new `lib/zeptomail.ts` wraps ZeptoMail's HTTP API (no SDK — a plain `fetch()` call, matching the API's documented shape) with a fire-and-forget `sendEmail()` that never throws. A new `lib/email-templates/purchase-confirmation.ts` builds the email content. The webhook's existing `after()` block (`app/api/lemonsqueezy/webhook/route.ts`) calls `sendEmail()` with the PDF attached as base64 right after `generateAndUploadPDF()` succeeds.

**Tech Stack:** Next.js 16 App Router, TypeScript, ZeptoMail HTTP API (`https://api.zeptomail.com/v1.1/email`), Jest (node environment)

## Global Constraints

- Website root for all file paths below: `Vehicle Comparison Site/`
- Branch: `git checkout -b feat/zeptomail-purchase-confirmation` from `main`
- Run `npm run type-check` and `npm run test:ci` after every task; fix all errors before proceeding
- Never push directly to `main` — PR + Vercel Preview required before merge
- `ZEPTOMAIL_API_KEY` and `ZEPTOMAIL_FROM_ADDRESS` are server-only (no `NEXT_PUBLIC_` prefix)
- Email send is always fire-and-forget from the webhook's perspective — never let an email failure mark a successfully-generated report as failed (see Task 4 for why this is structurally guaranteed, not just a convention)
- Per the resolved design decision in the spec (Section 6, item 6): ZeptoMail (this plan) and Zoho Campaigns (the separate nurture-email work) are kept on independent sending identities — do not reuse a Zoho Campaigns "from" address for this plan's sends
- Attachment must be built from the PDF buffer already in memory from the same request's render call — never re-fetch the file from Supabase Storage to attach it (this is the specific implementation detail that keeps Supabase egress impact at zero; see spec Section 5.2)

## Pre-Requisites (manual — complete before writing any code)

1. Go to the ZeptoMail console (via your Zoho account) → create a Mail Agent for `totallosstoolkit.com` if one doesn't already exist for transactional sending.
2. Verify the sending domain: add the SPF/DKIM DNS records ZeptoMail provides to `totallosstoolkit.com`'s DNS, then click Verify in the console — wait until it shows "Verified."
3. Generate a **Send Mail Token** (API key) for this Mail Agent — this is the value used in the `Authorization: Zoho-enczapikey <token>` header.
4. In **Vercel Dashboard → totallosstoolkit.com → Settings → Environment Variables**, add:
   - `ZEPTOMAIL_API_KEY` = the send mail token (all environments, server-only)
   - `ZEPTOMAIL_FROM_ADDRESS` = the verified sending address, e.g. `hello@totallosstoolkit.com`
5. In local `.env.local`, add the same two variables.
6. Per the spec's resolved warm-up guidance (Section 5.3): do not enable this in production until ZeptoMail has a short track record of clean sends on this domain. If Zoho Campaigns nurture emails (separate work) are live first, that does **not** count as warm-up for this ZeptoMail sending identity — they are independent tracks. If no other Zoho send exists yet, send a handful of manual test emails through the ZeptoMail console first and confirm they land in the inbox, not spam.

---

## Task 1: Return the PDF buffer from `generateAndUploadPDF`

**Files:**

- Modify: `lib/services/pdf-generator.tsx`
- Modify: `__tests__/lib/services/pdf-generator.test.ts`

**Interfaces:**

- Produces: `generateAndUploadPDF(options): Promise<{ success: boolean; error?: string; pdfUrl?: string; pdfBuffer?: Buffer }>` — adds `pdfBuffer` to the existing return type, populated only on success

- [ ] **Step 1: Write the failing tests**

`__tests__/lib/services/pdf-generator.test.ts` currently has no `@jest-environment node` docblock and doesn't mock `@/lib/db/supabase` (its existing tests only test pure functions, no DB calls). Add both at the very top of the file, before the existing `import { ADMIN_URL_TTL_SECONDS } from '@/lib/services/pdf-generator'` line:

```ts
/**
 * @jest-environment node
 */
jest.mock('@/lib/db/supabase')
```

Then change the existing import line from:

```ts
import { ADMIN_URL_TTL_SECONDS } from '@/lib/services/pdf-generator'
```

to:

```ts
import { supabaseAdmin } from '@/lib/db/supabase'
import { ADMIN_URL_TTL_SECONDS, generateAndUploadPDF } from '@/lib/services/pdf-generator'
```

Then add this new `describe` block after the existing `describe('PDF admin URL TTL constant', ...)` block:

```ts
describe('generateAndUploadPDF — buffer return (N1)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(supabaseAdmin.from as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: {
              id: 'report-1',
              vin: '1HGBH41JXMN109186',
              user_id: 'user-1',
              price_paid: 2900,
              status: 'pending',
              created_at: '2026-07-08T00:00:00Z',
              autodev_vin_data: null,
              marketcheck_valuation: null,
            },
            error: null,
          }),
        }),
      }),
      update: jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) }),
    })
    ;(supabaseAdmin.storage.from as jest.Mock).mockReturnValue({
      upload: jest.fn().mockResolvedValue({ error: null }),
      createSignedUrl: jest
        .fn()
        .mockResolvedValue({ data: { signedUrl: 'https://mock.url/report.pdf' }, error: null }),
    })
  })

  it('returns the rendered PDF buffer alongside pdfUrl on success', async () => {
    const result = await generateAndUploadPDF({ reportId: 'report-1' })

    expect(result.success).toBe(true)
    expect(result.pdfBuffer).toBeInstanceOf(Buffer)
  })

  it('does not include pdfBuffer when the report fetch fails', async () => {
    ;(supabaseAdmin.from as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
        }),
      }),
    })

    const result = await generateAndUploadPDF({ reportId: 'missing' })

    expect(result.success).toBe(false)
    expect(result.pdfBuffer).toBeUndefined()
  })
})
```

Note: `supabaseAdmin.storage.from` is the manual mock's `jest.fn().mockReturnThis()` by default (`lib/db/__mocks__/supabase.ts`) — the `beforeEach` above overrides it per-test with `mockReturnValue` so `upload`/`createSignedUrl` behave predictably for these two tests specifically, without affecting the mock's default shape for any other test file.

- [ ] **Step 2: Run to confirm the new tests fail**

```bash
cd "Vehicle Comparison Site" && npm run test:ci -- --testPathPatterns="lib/services/pdf-generator"
```

Expected: FAIL — `result.pdfBuffer` is `undefined` in the success case (the field doesn't exist on the return object yet)

- [ ] **Step 3: Update the return type and success return statement**

In `lib/services/pdf-generator.tsx`, find:

```ts
export async function generateAndUploadPDF(
  options: GeneratePDFOptions
): Promise<{ success: boolean; error?: string; pdfUrl?: string }> {
```

Replace with:

```ts
export async function generateAndUploadPDF(
  options: GeneratePDFOptions
): Promise<{ success: boolean; error?: string; pdfUrl?: string; pdfBuffer?: Buffer }> {
```

Then find the success return statement near the end of the function:

```ts
return {
  success: true,
  pdfUrl: signedUrlData.signedUrl,
}
```

Replace with:

```ts
return {
  success: true,
  pdfUrl: signedUrlData.signedUrl,
  pdfBuffer: Buffer.from(pdfBuffer),
}
```

- [ ] **Step 4: Run to confirm the tests pass**

```bash
cd "Vehicle Comparison Site" && npm run test:ci -- --testPathPatterns="lib/services/pdf-generator"
```

Expected: PASS — all tests (existing filename/TTL tests + 2 new)

- [ ] **Step 5: Run type-check**

```bash
cd "Vehicle Comparison Site" && npm run type-check
```

- [ ] **Step 6: Commit**

```bash
cd "Vehicle Comparison Site"
git add lib/services/pdf-generator.tsx __tests__/lib/services/pdf-generator.test.ts
git commit -m "feat: return PDF buffer from generateAndUploadPDF for email attachment reuse"
```

---

## Task 2: ZeptoMail send wrapper

**Files:**

- Create: `lib/zeptomail.ts`
- Create: `__tests__/lib/zeptomail.test.ts`

**Interfaces:**

- Produces: `sendEmail(params: { to: string; subject: string; html: string; attachments?: SendEmailAttachment[] }): Promise<void>` where `SendEmailAttachment = { content: string; mimeType: string; name: string }` — `content` is base64-encoded. Swallows all errors, no-ops when `ZEPTOMAIL_API_KEY` or `ZEPTOMAIL_FROM_ADDRESS` is missing.

- [ ] **Step 1: Write the failing tests**

Create `__tests__/lib/zeptomail.test.ts`:

```ts
/**
 * @jest-environment node
 */
import { sendEmail } from '@/lib/zeptomail'

describe('sendEmail (ZeptoMail)', () => {
  const ORIG_KEY = process.env.ZEPTOMAIL_API_KEY
  const ORIG_FROM = process.env.ZEPTOMAIL_FROM_ADDRESS

  beforeEach(() => {
    process.env.ZEPTOMAIL_API_KEY = 'test-api-key'
    process.env.ZEPTOMAIL_FROM_ADDRESS = 'hello@totallosstoolkit.com'
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, text: async () => '' })
  })

  afterEach(() => {
    if (ORIG_KEY === undefined) delete process.env.ZEPTOMAIL_API_KEY
    else process.env.ZEPTOMAIL_API_KEY = ORIG_KEY
    if (ORIG_FROM === undefined) delete process.env.ZEPTOMAIL_FROM_ADDRESS
    else process.env.ZEPTOMAIL_FROM_ADDRESS = ORIG_FROM
  })

  it('posts to the ZeptoMail API with the correct endpoint and auth header', async () => {
    await sendEmail({ to: 'user@example.com', subject: 'Hello', html: '<p>Hi</p>' })

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.zeptomail.com/v1.1/email',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Zoho-enczapikey test-api-key',
          'Content-Type': 'application/json',
        }),
      })
    )
  })

  it('sends from, to, subject, and htmlbody in the request body', async () => {
    await sendEmail({ to: 'user@example.com', subject: 'Hello', html: '<p>Hi</p>' })

    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body)
    expect(body.from).toEqual({ address: 'hello@totallosstoolkit.com', name: 'Total Loss Toolkit' })
    expect(body.to).toEqual([{ email_address: { address: 'user@example.com' } }])
    expect(body.subject).toBe('Hello')
    expect(body.htmlbody).toBe('<p>Hi</p>')
  })

  it('includes attachments in the request body when provided, mapped to ZeptoMail field names', async () => {
    await sendEmail({
      to: 'user@example.com',
      subject: 'Your report',
      html: '<p>Attached</p>',
      attachments: [{ content: 'YmFzZTY0', mimeType: 'application/pdf', name: 'report.pdf' }],
    })

    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body)
    expect(body.attachments).toEqual([
      { content: 'YmFzZTY0', mime_type: 'application/pdf', name: 'report.pdf' },
    ])
  })

  it('omits attachments key entirely when none are provided', async () => {
    await sendEmail({ to: 'user@example.com', subject: 'Hello', html: '<p>Hi</p>' })

    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body)
    expect(body.attachments).toBeUndefined()
  })

  it('does not call fetch when ZEPTOMAIL_API_KEY is missing', async () => {
    delete process.env.ZEPTOMAIL_API_KEY
    await sendEmail({ to: 'user@example.com', subject: 'Hello', html: '<p>Hi</p>' })
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('does not call fetch when ZEPTOMAIL_FROM_ADDRESS is missing', async () => {
    delete process.env.ZEPTOMAIL_FROM_ADDRESS
    await sendEmail({ to: 'user@example.com', subject: 'Hello', html: '<p>Hi</p>' })
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('resolves without throwing when fetch rejects', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network error'))
    await expect(
      sendEmail({ to: 'user@example.com', subject: 'Hello', html: '<p>Hi</p>' })
    ).resolves.not.toThrow()
  })

  it('resolves without throwing when the API returns a non-ok response', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue({ ok: false, status: 400, text: async () => 'Bad request' })
    await expect(
      sendEmail({ to: 'user@example.com', subject: 'Hello', html: '<p>Hi</p>' })
    ).resolves.not.toThrow()
  })
})
```

- [ ] **Step 2: Run to confirm it fails**

```bash
cd "Vehicle Comparison Site" && npm run test:ci -- --testPathPatterns="lib/zeptomail"
```

Expected: FAIL — `Cannot find module '@/lib/zeptomail'`

- [ ] **Step 3: Create the wrapper**

Create `lib/zeptomail.ts`:

```ts
export interface SendEmailAttachment {
  content: string // base64-encoded
  mimeType: string
  name: string
}

export interface SendEmailParams {
  to: string
  subject: string
  html: string
  attachments?: SendEmailAttachment[]
}

export async function sendEmail(params: SendEmailParams): Promise<void> {
  const apiKey = process.env.ZEPTOMAIL_API_KEY
  const fromAddress = process.env.ZEPTOMAIL_FROM_ADDRESS
  if (!apiKey || !fromAddress) return

  try {
    const response = await fetch('https://api.zeptomail.com/v1.1/email', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Zoho-enczapikey ${apiKey}`,
      },
      body: JSON.stringify({
        from: { address: fromAddress, name: 'Total Loss Toolkit' },
        to: [{ email_address: { address: params.to } }],
        subject: params.subject,
        htmlbody: params.html,
        ...(params.attachments && {
          attachments: params.attachments.map(a => ({
            content: a.content,
            mime_type: a.mimeType,
            name: a.name,
          })),
        }),
      }),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      console.error('[zeptomail] send failed:', response.status, errorBody)
    }
  } catch (err) {
    console.error('[zeptomail] send error:', err)
  }
}
```

- [ ] **Step 4: Run to confirm it passes**

```bash
cd "Vehicle Comparison Site" && npm run test:ci -- --testPathPatterns="lib/zeptomail"
```

Expected: PASS — 8 tests

- [ ] **Step 5: Run type-check**

```bash
cd "Vehicle Comparison Site" && npm run type-check
```

- [ ] **Step 6: Commit**

```bash
cd "Vehicle Comparison Site"
git add lib/zeptomail.ts __tests__/lib/zeptomail.test.ts
git commit -m "feat: add ZeptoMail sendEmail wrapper"
```

---

## Task 3: Purchase confirmation email template

**Files:**

- Create: `lib/email-templates/purchase-confirmation.ts`
- Create: `__tests__/lib/email-templates/purchase-confirmation.test.ts`

**Interfaces:**

- Produces: `getPurchaseConfirmationEmail(params: { email: string; reportViewUrl: string }): { subject: string; html: string }`

- [ ] **Step 1: Write the failing test**

Create `__tests__/lib/email-templates/purchase-confirmation.test.ts`:

```ts
import { getPurchaseConfirmationEmail } from '@/lib/email-templates/purchase-confirmation'

const PARAMS = {
  email: 'buyer@example.com',
  reportViewUrl: 'https://www.totallosstoolkit.com/reports/abc-123/view',
}

describe('getPurchaseConfirmationEmail', () => {
  it('returns a non-empty subject', () => {
    const { subject } = getPurchaseConfirmationEmail(PARAMS)
    expect(subject.length).toBeGreaterThan(0)
  })

  it('includes the report view link', () => {
    const { html } = getPurchaseConfirmationEmail(PARAMS)
    expect(html).toContain(PARAMS.reportViewUrl)
  })

  it('includes the buyer email so they know which address the account uses', () => {
    const { html } = getPurchaseConfirmationEmail(PARAMS)
    expect(html).toContain(PARAMS.email)
  })

  it('mentions the PDF attachment so recipients know to look for it', () => {
    const { html } = getPurchaseConfirmationEmail(PARAMS)
    expect(html.toLowerCase()).toContain('attached')
  })

  it('explains no password is needed to sign in later', () => {
    const { html } = getPurchaseConfirmationEmail(PARAMS)
    expect(html.toLowerCase()).toContain("don't need a password")
  })
})
```

- [ ] **Step 2: Run to confirm it fails**

```bash
cd "Vehicle Comparison Site" && npm run test:ci -- --testPathPatterns="email-templates/purchase-confirmation"
```

Expected: FAIL — module not found

- [ ] **Step 3: Create the template**

Create `lib/email-templates/purchase-confirmation.ts`:

```ts
function wrap(body: string): string {
  return `<!DOCTYPE html>
<html>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1e293b;line-height:1.7;font-size:16px;">
${body}
</body>
</html>`
}

export function getPurchaseConfirmationEmail(params: { email: string; reportViewUrl: string }): {
  subject: string
  html: string
} {
  return {
    subject: 'Your Total Loss Toolkit report is ready',
    html: wrap(`
<p>Your report is ready — it's attached to this email as a PDF, and also saved to your account online.</p>

<p><a href="${params.reportViewUrl}" style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;">View Your Report Online</a></p>

<p>We've created an account for you using <strong>${params.email}</strong>. You don't need a password — whenever you want to come back, just enter your email on the sign-in page and we'll email you a secure link.</p>

<p>Questions? Just reply to this email or reach us at hello@totallosstoolkit.com.</p>

<p>— Total Loss Toolkit</p>`),
  }
}
```

- [ ] **Step 4: Run to confirm it passes**

```bash
cd "Vehicle Comparison Site" && npm run test:ci -- --testPathPatterns="email-templates/purchase-confirmation"
```

Expected: PASS — 5 tests

- [ ] **Step 5: Run type-check**

```bash
cd "Vehicle Comparison Site" && npm run type-check
```

- [ ] **Step 6: Commit**

```bash
cd "Vehicle Comparison Site"
git add lib/email-templates/purchase-confirmation.ts __tests__/lib/email-templates/purchase-confirmation.test.ts
git commit -m "feat: add purchase confirmation email template"
```

---

## Task 4: Wire the send into the webhook's `after()` block

**Files:**

- Modify: `app/api/lemonsqueezy/webhook/route.ts`
- Modify: `__tests__/app/api/lemonsqueezy/webhook/route.test.ts`

**Interfaces:**

- Consumes: `generateAndUploadPDF` (now returns `pdfBuffer` — Task 1), `sendEmail` from `@/lib/zeptomail` (Task 2), `getPurchaseConfirmationEmail` from `@/lib/email-templates/purchase-confirmation` (Task 3)
- Uses existing in-scope variables in `handleOrderCreated`: `reportId`, `customerEmail`, `appUrl`

- [ ] **Step 1: Write the failing tests**

In `__tests__/app/api/lemonsqueezy/webhook/route.test.ts`, add two new mocks near the top, directly after the existing `jest.mock('@/lib/services/pdf-generator', ...)` block:

```ts
jest.mock('@/lib/zeptomail', () => ({
  sendEmail: jest.fn().mockResolvedValue(undefined),
}))
jest.mock('@/lib/email-templates/purchase-confirmation', () => ({
  getPurchaseConfirmationEmail: jest.fn().mockReturnValue({
    subject: 'Your Total Loss Toolkit report is ready',
    html: '<p>mock html</p>',
  }),
}))
```

Add the corresponding imports near the top, after the existing `import { logApiCall } from '@/lib/api/api-call-logger'` line:

```ts
import { sendEmail } from '@/lib/zeptomail'
const mockSendEmail = sendEmail as jest.Mock
```

Append this new `describe` block at the end of the file:

```ts
describe('POST /api/lemonsqueezy/webhook — purchase confirmation email (N1)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(client.verifyWebhookSignature as jest.Mock).mockReturnValue(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(supabaseAdmin as any).rpc = jest.fn().mockResolvedValue({ data: null, error: null })

    mockAdmin.from = jest.fn().mockReturnValue({
      insert: jest.fn().mockResolvedValue({ error: null }),
      // Handles the user_profiles.upsert() call in handleOrderCreated (customerName is
      // present in makeOrderCreatedBody(), and resolveUserFromEmail below resolves a
      // user id, so that branch executes) — same object serves every table the webhook
      // touches, since none of these tests distinguish by table name.
      upsert: jest.fn().mockResolvedValue({ error: null }),
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: {
              vin: '1HGBH41JXMN109186',
              mileage: 35000,
              zip_code: '90210',
              vehicle_data: { year: 2020 },
              marketcheck_valuation: null,
            },
            error: null,
          }),
        }),
      }),
      update: jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    // makeOrderCreatedBody() has no custom_data.userId, so handleOrderCreated treats this
    // as an anonymous purchase and calls resolveUserFromEmail(), which calls these two —
    // without mocks here, awaiting an un-mocked jest.fn() (resolves to undefined) crashes
    // on the destructure inside resolveUserFromEmail.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(mockAdmin.auth.admin.createUser as jest.Mock).mockResolvedValue({
      data: { user: { id: 'user-resolved-1' } },
      error: null,
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(mockAdmin.auth.signInWithOtp as jest.Mock).mockResolvedValue({ error: null })

    jest.spyOn(autodev, 'fetchAutoDevVinDecode').mockResolvedValue({
      success: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: { make: 'Honda', model: 'Civic', vehicle: { year: 2020 } } as any,
    })
    jest.spyOn(marketcheck, 'fetchMarketCheckData').mockResolvedValue({
      success: false,
      error: 'no data',
    })
    mockValidateListingUrls.mockResolvedValue({
      prediction: {},
      stats: { checkedCount: 0, failedCount: 0, failedUrls: [], validatedUrls: [], batchesUsed: 0 },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockSupplementComparables.mockResolvedValue({ prediction: {}, supplemented: false } as any)
  })

  function makeRequest() {
    return new Request('http://localhost/api/lemonsqueezy/webhook', {
      method: 'POST',
      body: makeOrderCreatedBody(),
      headers: {
        'x-signature': 'valid',
        'x-forwarded-host': 'www.totallosstoolkit.com',
        'x-forwarded-proto': 'https',
      },
    })
  }

  it('sends a purchase confirmation email with the PDF attached after successful generation', async () => {
    jest.spyOn(pdfGenerator, 'generateAndUploadPDF').mockResolvedValue({
      success: true,
      pdfUrl: 'https://example.com/report.pdf',
      pdfBuffer: Buffer.from('fake-pdf-bytes'),
    })

    await POST(makeRequest())
    await new Promise(resolve => setImmediate(resolve))

    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'buyer@example.com',
        attachments: [
          expect.objectContaining({
            mimeType: 'application/pdf',
            name: 'total-loss-report.pdf',
          }),
        ],
      })
    )
  })

  it('base64-encodes the PDF buffer for the attachment', async () => {
    jest.spyOn(pdfGenerator, 'generateAndUploadPDF').mockResolvedValue({
      success: true,
      pdfUrl: 'https://example.com/report.pdf',
      pdfBuffer: Buffer.from('fake-pdf-bytes'),
    })

    await POST(makeRequest())
    await new Promise(resolve => setImmediate(resolve))

    const callArgs = mockSendEmail.mock.calls[0][0]
    expect(callArgs.attachments[0].content).toBe(Buffer.from('fake-pdf-bytes').toString('base64'))
  })

  it('does not send an email when PDF generation fails', async () => {
    jest.spyOn(pdfGenerator, 'generateAndUploadPDF').mockResolvedValue({
      success: false,
      error: 'render failed',
    })

    await POST(makeRequest())
    await new Promise(resolve => setImmediate(resolve))

    expect(mockSendEmail).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run to confirm the new tests fail**

```bash
cd "Vehicle Comparison Site" && npm run test:ci -- --testPathPatterns="lemonsqueezy/webhook"
```

Expected: existing tests still pass, 3 new tests FAIL — `sendEmail` is never called yet

- [ ] **Step 3: Update the webhook's `after()` block**

In `app/api/lemonsqueezy/webhook/route.ts`, add these two imports after the existing `import { upsertLead } from '@/lib/leads'` line:

```ts
import { sendEmail } from '@/lib/zeptomail'
import { getPurchaseConfirmationEmail } from '@/lib/email-templates/purchase-confirmation'
```

Then find the `after()` block:

```ts
after(async () => {
  try {
    console.log(`[Webhook] PDF generation starting for report ${reportId}`)
    await generateAndUploadPDF({ reportId })
    console.log(`[Webhook] PDF generation completed for report ${reportId}`)
  } catch (error) {
    console.error(`PDF generation failed for report ${reportId}:`, error)
    await supabase.from('reports').update({ status: 'failed' }).eq('id', reportId)
    console.log(`Report ${reportId} marked as failed`)
  }
})
```

Replace it with:

```ts
after(async () => {
  try {
    console.log(`[Webhook] PDF generation starting for report ${reportId}`)
    const pdfResult = await generateAndUploadPDF({ reportId })
    console.log(`[Webhook] PDF generation completed for report ${reportId}`)

    // Fire-and-forget: sendEmail() never throws (Task 2), so a delivery
    // failure here can never cause the report to be marked 'failed' below.
    if (pdfResult.success && pdfResult.pdfBuffer && customerEmail) {
      const { subject, html } = getPurchaseConfirmationEmail({
        email: customerEmail,
        reportViewUrl: `${appUrl}/reports/${reportId}/view`,
      })
      await sendEmail({
        to: customerEmail,
        subject,
        html,
        attachments: [
          {
            content: pdfResult.pdfBuffer.toString('base64'),
            mimeType: 'application/pdf',
            name: 'total-loss-report.pdf',
          },
        ],
      })
      console.log(`[Webhook] Purchase confirmation email sent for report ${reportId}`)
    }
  } catch (error) {
    console.error(`PDF generation failed for report ${reportId}:`, error)
    await supabase.from('reports').update({ status: 'failed' }).eq('id', reportId)
    console.log(`Report ${reportId} marked as failed`)
  }
})
```

- [ ] **Step 4: Run to confirm the tests pass**

```bash
cd "Vehicle Comparison Site" && npm run test:ci -- --testPathPatterns="lemonsqueezy/webhook"
```

Expected: PASS — all tests (existing + 3 new)

- [ ] **Step 5: Run type-check**

```bash
cd "Vehicle Comparison Site" && npm run type-check
```

- [ ] **Step 6: Run the full test suite to confirm no regressions**

```bash
cd "Vehicle Comparison Site" && npm run test:ci
```

- [ ] **Step 7: Commit**

```bash
cd "Vehicle Comparison Site"
git add app/api/lemonsqueezy/webhook/route.ts __tests__/app/api/lemonsqueezy/webhook/route.test.ts
git commit -m "feat: send purchase confirmation email with PDF attached via ZeptoMail"
```

---

## Task 5: Open PR and verify on Vercel Preview

- [ ] **Step 1: Push branch**

```bash
cd "Vehicle Comparison Site"
git push -u origin feat/zeptomail-purchase-confirmation
```

- [ ] **Step 2: Open PR on GitHub**

Navigate to `github.com/Lemmeyg/VehicleValuation` → open PR from `feat/zeptomail-purchase-confirmation` → `main`.

- [ ] **Step 3: Confirm Vercel env vars are set**

Vercel Dashboard → Settings → Environment Variables → confirm `ZEPTOMAIL_API_KEY` and `ZEPTOMAIL_FROM_ADDRESS` exist (all environments). Trigger a Preview redeploy if you just added them.

- [ ] **Step 4: Smoke-test on Preview URL**

1. Complete a real test purchase (LemonSqueezy test mode) using your own email address.
2. Confirm you land on the report view page as expected (no regression to the existing flow).
3. Check your inbox — the confirmation email should arrive within about a minute, from the `ZEPTOMAIL_FROM_ADDRESS` you configured, with a PDF attachment named `total-loss-report.pdf`.
4. Open the attached PDF and confirm it matches the report shown on-site.
5. Click "View Your Report Online" in the email and confirm it lands on the correct report view page.
6. Check the ZeptoMail console's send log to confirm the send is logged and shows delivered (not bounced).

- [ ] **Step 5: Verify the resource-impact claims from the spec**

Watch the Vercel Fluid Active CPU graph and Supabase Storage egress metric for the next few days of real traffic — the spec (Section 5.2) predicts negligible change on both. If either moves noticeably, investigate before assuming this feature is resource-neutral at scale.

- [ ] **Step 6: Merge PR after all checks pass**

---

## Manual QA Checklist

- [ ] ZeptoMail domain verified, API key generated and set in Vercel (all environments)
- [ ] Confirmation email arrives within ~1 minute of purchase, from the correct address
- [ ] PDF attachment opens correctly and matches the on-site report
- [ ] "View Your Report Online" link in the email works
- [ ] A failed PDF generation does not send an email (and still correctly marks the report `failed`, unchanged from before this plan)
- [ ] ZeptoMail console send log shows the send as delivered, not bounced or spam-flagged
- [ ] All CI tests pass on the PR
- [ ] No visible increase in Vercel Fluid Active CPU or Supabase Storage egress after a few days of production traffic
