# Directory Auth Removal + Pricing Popup Updates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the login gate from the directory contact form, replace the pricing page popup trigger from mouse-leave to link/navigation click interception, and update the popup copy.

**Architecture:** Three targeted edits to existing components. `ContactUsDialog` drops its auth redirect and gains editable name/email fields. A new `ExitIntentPopup` component replaces the unmerged feature-branch version with a link-click trigger and updated copy. The pricing page mounts the popup and adds `data-buy-cta` to buy buttons as a safety exclusion.

**Tech Stack:** Next.js 16, React 19, TypeScript, Jest + React Testing Library, Tailwind CSS

---

## File Map

| File                                                      | Action                                                              |
| --------------------------------------------------------- | ------------------------------------------------------------------- |
| `components/directory/ContactUsDialog.tsx`                | Modify — remove auth gate, make name/email editable                 |
| `components/ExitIntentPopup.tsx`                          | Create — new component with link-click trigger + updated copy       |
| `app/pricing/page.tsx`                                    | Modify — mount `ExitIntentPopup`, add `data-buy-cta` to buy buttons |
| `__tests__/components/directory/ContactUsDialog.test.tsx` | Create — tests for auth-free form                                   |
| `__tests__/components/ExitIntentPopup.test.tsx`           | Create — tests for trigger logic and copy                           |

---

## Task 1: Create Feature Branch

**Files:** none

- [ ] **Step 1: Sync main and branch**

```bash
cd "../Vehicle Comparison Site"
git checkout main
git pull origin main
git checkout -b feat/directory-auth-and-pricing-popup
```

Expected: new branch checked out cleanly.

- [ ] **Step 2: Verify starting state**

```bash
git status
```

Expected: `On branch feat/directory-auth-and-pricing-popup`, nothing to commit.

---

## Task 2: Remove Auth Gate from ContactUsDialog

**Files:**

- Modify: `components/directory/ContactUsDialog.tsx`
- Create: `__tests__/components/directory/ContactUsDialog.test.tsx`

### Step 1 — Write the failing tests

- [ ] Create `__tests__/components/directory/ContactUsDialog.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ContactUsDialog from '@/components/directory/ContactUsDialog'

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
}))

beforeEach(() => {
  ;(global.fetch as jest.Mock).mockResolvedValue({
    ok: true,
    json: async () => ({}),
  })
})

describe('ContactUsDialog — unauthenticated', () => {
  it('opens the dialog without redirecting', async () => {
    render(<ContactUsDialog isAuthenticated={false} userName="" userEmail="" />)
    fireEvent.click(screen.getByText('contact us'))
    expect(screen.getByRole('heading', { name: 'Request a Service' })).toBeInTheDocument()
  })

  it('shows empty name and email fields', () => {
    render(<ContactUsDialog isAuthenticated={false} userName="" userEmail="" />)
    fireEvent.click(screen.getByText('contact us'))
    expect(screen.getByLabelText('Name')).toHaveValue('')
    expect(screen.getByLabelText('Email')).toHaveValue('')
  })

  it('allows typing into name and email fields', () => {
    render(<ContactUsDialog isAuthenticated={false} userName="" userEmail="" />)
    fireEvent.click(screen.getByText('contact us'))
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Jane Doe' } })
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'jane@example.com' } })
    expect(screen.getByLabelText('Name')).toHaveValue('Jane Doe')
    expect(screen.getByLabelText('Email')).toHaveValue('jane@example.com')
  })
})

describe('ContactUsDialog — authenticated', () => {
  it('pre-populates name and email from props', () => {
    render(
      <ContactUsDialog isAuthenticated={true} userName="Jane Doe" userEmail="jane@example.com" />
    )
    fireEvent.click(screen.getByText('contact us'))
    expect(screen.getByLabelText('Name')).toHaveValue('Jane Doe')
    expect(screen.getByLabelText('Email')).toHaveValue('jane@example.com')
  })

  it('allows editing pre-populated fields', () => {
    render(
      <ContactUsDialog isAuthenticated={true} userName="Jane Doe" userEmail="jane@example.com" />
    )
    fireEvent.click(screen.getByText('contact us'))
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'John Doe' } })
    expect(screen.getByLabelText('Name')).toHaveValue('John Doe')
  })
})

describe('ContactUsDialog — submission', () => {
  it('sends name and email typed by user in the request body', async () => {
    render(<ContactUsDialog isAuthenticated={false} userName="" userEmail="" />)
    fireEvent.click(screen.getByText('contact us'))
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Test User' } })
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } })
    fireEvent.change(screen.getByRole('textbox', { name: /what service do you need/i }), {
      target: { value: 'Need a public adjuster' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Submit Request' }))
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/suppliers/service-request',
        expect.objectContaining({
          body: JSON.stringify({
            contactName: 'Test User',
            contactEmail: 'test@example.com',
            message: 'Need a public adjuster',
            serviceNeeded: 'Service Required',
          }),
        })
      )
    })
  })
})
```

- [ ] **Step 2: Run tests — expect them to fail**

```bash
npx jest __tests__/components/directory/ContactUsDialog.test.tsx --no-coverage
```

Expected: tests fail because the component still redirects unauthenticated users.

- [ ] **Step 3: Implement the changes in `components/directory/ContactUsDialog.tsx`**

Replace the entire file with:

```tsx
'use client'

import { useState } from 'react'
import { X, CheckCircle, AlertCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface ContactUsDialogProps {
  isAuthenticated: boolean
  userName: string
  userEmail: string
}

export default function ContactUsDialog({ userName, userEmail }: ContactUsDialogProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState(userName)
  const [email, setEmail] = useState(userEmail)
  const [message, setMessage] = useState('')

  const handleOpen = () => {
    setIsOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch('/api/suppliers/service-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactName: name,
          contactEmail: email,
          message,
          serviceNeeded: 'Service Required',
        }),
      })

      if (response.ok) {
        setIsSuccess(true)
        setTimeout(() => {
          setIsOpen(false)
          setIsSuccess(false)
          setMessage('')
          router.refresh()
        }, 2000)
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to submit request')
      }
    } catch {
      setError('An error occurred. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={handleOpen}
        className="text-white underline hover:text-slate-100 font-semibold transition-colors"
      >
        contact us
      </button>

      {/* Dialog */}
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          {/* Backdrop */}
          <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setIsOpen(false)} />

          {/* Dialog */}
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6">
              {/* Close Button */}
              <button
                onClick={() => setIsOpen(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>

              {/* Success State */}
              {isSuccess ? (
                <div className="text-center py-8">
                  <div className="mx-auto w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
                    <CheckCircle className="h-10 w-10 text-emerald-600" />
                  </div>
                  <h3 className="text-2xl font-bold text-slate-900 mb-2">Request Received!</h3>
                  <p className="text-slate-600">
                    Thank you for letting us know. We&apos;ll work on adding providers for your
                    needs.
                  </p>
                </div>
              ) : (
                <>
                  {/* Header */}
                  <div className="mb-6">
                    <h2 className="text-2xl font-bold text-slate-900 mb-2">Request a Service</h2>
                    <p className="text-sm text-slate-600">
                      Let us know what type of service provider you need in your area.
                    </p>
                  </div>

                  {/* Form */}
                  <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Name */}
                    <div>
                      <label
                        htmlFor="contact-name"
                        className="block text-sm font-medium text-slate-700 mb-1"
                      >
                        Name
                      </label>
                      <input
                        id="contact-name"
                        type="text"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        required
                        placeholder="Your name"
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>

                    {/* Email */}
                    <div>
                      <label
                        htmlFor="contact-email"
                        className="block text-sm font-medium text-slate-700 mb-1"
                      >
                        Email
                      </label>
                      <input
                        id="contact-email"
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        required
                        placeholder="your@email.com"
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>

                    {/* Subject (static) */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Subject
                      </label>
                      <input
                        type="text"
                        value="Service Required"
                        readOnly
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-600"
                      />
                    </div>

                    {/* Message */}
                    <div>
                      <label
                        htmlFor="contact-message"
                        className="block text-sm font-medium text-slate-700 mb-1"
                      >
                        What service do you need? <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        id="contact-message"
                        value={message}
                        onChange={e => setMessage(e.target.value)}
                        required
                        rows={4}
                        placeholder="Describe the type of service provider you're looking for and your location..."
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
                      />
                    </div>

                    {/* Error Message */}
                    {error && (
                      <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
                        <p className="text-sm text-red-700">{error}</p>
                      </div>
                    )}

                    {/* Submit Button */}
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full px-4 py-3 bg-gradient-to-r from-primary-600 to-emerald-600 text-white font-semibold rounded-lg hover:from-primary-700 hover:to-emerald-700 transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? 'Sending...' : 'Submit Request'}
                    </button>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
```

- [ ] **Step 4: Run tests — expect them to pass**

```bash
npx jest __tests__/components/directory/ContactUsDialog.test.tsx --no-coverage
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add components/directory/ContactUsDialog.tsx __tests__/components/directory/ContactUsDialog.test.tsx
git commit -m "feat: remove login requirement from directory contact form"
```

---

## Task 3: Build ExitIntentPopup Component

**Files:**

- Create: `components/ExitIntentPopup.tsx`
- Create: `__tests__/components/ExitIntentPopup.test.tsx`

### Step 1 — Write the failing tests

- [ ] Create `__tests__/components/ExitIntentPopup.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import ExitIntentPopup from '@/components/ExitIntentPopup'

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
}))

jest.mock('@/lib/analytics/events', () => ({
  trackEvent: jest.fn(),
}))

// jsdom doesn't implement history.pushState fully — stub it
const pushStateSpy = jest.spyOn(window.history, 'pushState').mockImplementation(() => {})

afterEach(() => {
  sessionStorage.clear()
  pushStateSpy.mockClear()
})

describe('ExitIntentPopup — initial state', () => {
  it('renders nothing by default', () => {
    render(<ExitIntentPopup vin="1HGCM82633A123456" reportId="r1" onSelectPlan={jest.fn()} />)
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
  })
})

describe('ExitIntentPopup — link click trigger', () => {
  it('shows the popup when a link is clicked', () => {
    render(
      <>
        <ExitIntentPopup vin="1HGCM82633A123456" reportId="r1" onSelectPlan={jest.fn()} />
        <a href="/knowledge-base">KB</a>
      </>
    )
    fireEvent.click(screen.getByText('KB'))
    expect(
      screen.getByText(/your insurance company doesn't want you to have this/i)
    ).toBeInTheDocument()
  })

  it('does not show popup for buy CTA anchors', () => {
    render(
      <>
        <ExitIntentPopup vin="1HGCM82633A123456" reportId="r1" onSelectPlan={jest.fn()} />
        <div data-buy-cta>
          <a href="/buy">Buy Now</a>
        </div>
      </>
    )
    fireEvent.click(screen.getByText('Buy Now'))
    expect(screen.queryByText(/insurance company/i)).not.toBeInTheDocument()
  })

  it('does not show popup for hash-only links', () => {
    render(
      <>
        <ExitIntentPopup vin="1HGCM82633A123456" reportId="r1" onSelectPlan={jest.fn()} />
        <a href="#faq">FAQ</a>
      </>
    )
    fireEvent.click(screen.getByText('FAQ'))
    expect(screen.queryByText(/insurance company/i)).not.toBeInTheDocument()
  })

  it('does not show popup a second time in the same session', () => {
    sessionStorage.setItem('exit_popup_shown', 'true')
    render(
      <>
        <ExitIntentPopup vin="1HGCM82633A123456" reportId="r1" onSelectPlan={jest.fn()} />
        <a href="/home">Home</a>
      </>
    )
    fireEvent.click(screen.getByText('Home'))
    expect(screen.queryByText(/insurance company/i)).not.toBeInTheDocument()
  })
})

describe('ExitIntentPopup — copy', () => {
  it('shows the correct headline', () => {
    render(
      <>
        <ExitIntentPopup vin="1HGCM82633A123456" reportId="r1" onSelectPlan={jest.fn()} />
        <a href="/home">Home</a>
      </>
    )
    fireEvent.click(screen.getByText('Home'))
    expect(
      screen.getByText(/before you go — your insurance company doesn't want you to have this/i)
    ).toBeInTheDocument()
  })

  it('shows the correct subtext', () => {
    render(
      <>
        <ExitIntentPopup vin="1HGCM82633A123456" reportId="r1" onSelectPlan={jest.fn()} />
        <a href="/home">Home</a>
      </>
    )
    fireEvent.click(screen.getByText('Home'))
    expect(screen.getByText(/average settlement gap is \$2,800/i)).toBeInTheDocument()
  })

  it('shows the correct CTA button text', () => {
    render(
      <>
        <ExitIntentPopup vin="1HGCM82633A123456" reportId="r1" onSelectPlan={jest.fn()} />
        <a href="/home">Home</a>
      </>
    )
    fireEvent.click(screen.getByText('Home'))
    expect(screen.getByRole('button', { name: /get my report — \$19/i })).toBeInTheDocument()
  })
})

describe('ExitIntentPopup — CTA action', () => {
  it('calls onSelectPlan with the discount code when CTA is clicked', () => {
    const mockSelectPlan = jest.fn()
    render(
      <>
        <ExitIntentPopup vin="1HGCM82633A123456" reportId="r1" onSelectPlan={mockSelectPlan} />
        <a href="/home">Home</a>
      </>
    )
    fireEvent.click(screen.getByText('Home'))
    fireEvent.click(screen.getByRole('button', { name: /get my report/i }))
    expect(mockSelectPlan).toHaveBeenCalledWith('STAY19')
  })
})

describe('ExitIntentPopup — back button trigger', () => {
  it('shows the popup when popstate fires', () => {
    render(<ExitIntentPopup vin="1HGCM82633A123456" reportId="r1" onSelectPlan={jest.fn()} />)
    fireEvent(window, new PopStateEvent('popstate'))
    expect(screen.queryByText(/insurance company/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests — expect them to fail**

```bash
npx jest __tests__/components/ExitIntentPopup.test.tsx --no-coverage
```

Expected: fail — `ExitIntentPopup` doesn't exist yet.

- [ ] **Step 3: Create `components/ExitIntentPopup.tsx`**

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import { trackEvent } from '@/lib/analytics/events'

interface ExitIntentPopupProps {
  vin: string
  reportId: string
  onSelectPlan: (discountCode: string) => void
}

const DISCOUNT_CODE = process.env.NEXT_PUBLIC_EXIT_INTENT_DISCOUNT_CODE ?? 'STAY19'

export default function ExitIntentPopup({ vin, reportId, onSelectPlan }: ExitIntentPopupProps) {
  const [visible, setVisible] = useState(false)
  const pendingHrefRef = useRef<string | null>(null)
  const isBackButtonRef = useRef(false)
  const hasTriggeredRef = useRef(false)
  const router = useRouter()

  useEffect(() => {
    history.pushState(null, '', window.location.href)

    const showPopup = () => {
      if (hasTriggeredRef.current) return
      if (sessionStorage.getItem('exit_popup_shown')) return
      hasTriggeredRef.current = true
      sessionStorage.setItem('exit_popup_shown', 'true')
      setVisible(true)
      trackEvent('exit_intent_popup_shown', { reportId, vin })
    }

    const handleClick = (e: MouseEvent) => {
      let target = e.target as HTMLElement | null
      while (target && target.tagName !== 'A') {
        target = target.parentElement
      }
      if (!target) return
      const anchor = target as HTMLAnchorElement
      if (anchor.closest('[data-buy-cta]')) return
      const href = anchor.getAttribute('href')
      if (!href || href.startsWith('#')) return
      e.preventDefault()
      pendingHrefRef.current = href
      isBackButtonRef.current = false
      showPopup()
    }

    const handlePopState = () => {
      isBackButtonRef.current = true
      pendingHrefRef.current = null
      history.pushState(null, '', window.location.href)
      showPopup()
    }

    document.addEventListener('click', handleClick)
    window.addEventListener('popstate', handlePopState)
    return () => {
      document.removeEventListener('click', handleClick)
      window.removeEventListener('popstate', handlePopState)
    }
  }, [vin, reportId])

  const handleDismiss = () => {
    setVisible(false)
    trackEvent('exit_intent_popup_dismissed', { reportId, vin })
    if (isBackButtonRef.current) {
      router.back()
    } else if (pendingHrefRef.current) {
      router.push(pendingHrefRef.current)
    }
  }

  const handleCTA = () => {
    trackEvent('exit_intent_popup_converted', { reportId, vin })
    onSelectPlan(DISCOUNT_CODE)
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={handleDismiss}
    >
      <div
        className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 p-8"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="text-center">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">
            Before you go — your insurance company doesn&apos;t want you to have this.
          </h2>
          <p className="text-slate-500 text-sm mb-6">
            The average settlement gap is $2,800. Don&apos;t leave without the data to fight back.
          </p>

          <button
            onClick={handleCTA}
            className="w-full py-4 px-6 bg-gradient-to-r from-primary-600 to-emerald-600 hover:from-primary-700 hover:to-emerald-700 text-white rounded-xl font-semibold text-base transition-all shadow-lg"
          >
            Get My Report — $19
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests — expect them to pass**

```bash
npx jest __tests__/components/ExitIntentPopup.test.tsx --no-coverage
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add components/ExitIntentPopup.tsx __tests__/components/ExitIntentPopup.test.tsx
git commit -m "feat: add ExitIntentPopup with link-click trigger and updated copy"
```

---

## Task 4: Mount ExitIntentPopup on Pricing Page

**Files:**

- Modify: `app/pricing/page.tsx`

- [ ] **Step 1: Add the import at the top of `app/pricing/page.tsx`**

After the existing imports (around line 20), add:

```tsx
import ExitIntentPopup from '@/components/ExitIntentPopup'
```

- [ ] **Step 2: Add `data-buy-cta` to the buy buttons**

Find the `<Button>` component that renders the buy CTA (around line 696–706). It currently reads:

```tsx
<Button
  onClick={() => handleSelectPlan(tier)}
  disabled={processingPayment}
  className={`w-full mt-4 py-5 text-base font-semibold ${
    tier.recommended
      ? 'bg-gradient-to-r from-primary-600 to-emerald-600 hover:from-primary-700 hover:to-emerald-700'
      : 'bg-slate-900 hover:bg-slate-800'
  }`}
>
  {processingPayment ? 'Processing...' : `Get ${tier.name} — $${tier.price}`}
</Button>
```

Replace with (add `data-buy-cta`):

```tsx
<Button
  data-buy-cta
  onClick={() => handleSelectPlan(tier)}
  disabled={processingPayment}
  className={`w-full mt-4 py-5 text-base font-semibold ${
    tier.recommended
      ? 'bg-gradient-to-r from-primary-600 to-emerald-600 hover:from-primary-700 hover:to-emerald-700'
      : 'bg-slate-900 hover:bg-slate-800'
  }`}
>
  {processingPayment ? 'Processing...' : `Get ${tier.name} — $${tier.price}`}
</Button>
```

- [ ] **Step 3: Add the exit intent handler and mount the popup**

After the existing handler functions (around line 350, before the `return` statement), add:

```tsx
const handleExitIntentSelectPlan = (_discountCode: string) => {
  const basicTier = PRICING_TIERS.find(t => t.id === 'BASIC') ?? PRICING_TIERS[0]
  handleSelectPlan(basicTier)
}
```

At the very bottom of the JSX return (just before the closing `</Suspense>` or the outer wrapper), add the popup mount — place it after `<Footer />` and before the existing beta modal comment:

```tsx
{
  /* Exit Intent Popup */
}
{
  report && (
    <ExitIntentPopup
      vin={report.vin}
      reportId={report.id}
      onSelectPlan={handleExitIntentSelectPlan}
    />
  )
}
```

- [ ] **Step 4: Run the full test suite**

```bash
npx jest --no-coverage
```

Expected: all tests pass. Fix any type errors flagged before moving on.

- [ ] **Step 5: Run type check**

```bash
npm run type-check
```

Expected: no errors. If TypeScript complains about `data-buy-cta` on `Button`, the `ButtonHTMLAttributes<HTMLButtonElement>` spread in `Button.tsx` already allows all `data-*` attributes — no change needed.

- [ ] **Step 6: Commit**

```bash
git add app/pricing/page.tsx
git commit -m "feat: mount ExitIntentPopup on pricing page with link-click trigger"
```

---

## Task 5: Manual QA + PR

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

- [ ] **Step 2: Test the directory form**

Navigate to `http://localhost:3000/directory`. Find the "Don't see a provider?" section and click "contact us".

Verify:

- The dialog opens immediately (no redirect to login) when not logged in
- Name and email fields are empty and editable
- Submitting with a name, email, and message works (check Network tab for the POST to `/api/suppliers/service-request`)
- When logged in, name and email are pre-populated but still editable

- [ ] **Step 3: Test the exit intent popup on the pricing page**

Navigate to `http://localhost:3000/pricing?reportId=<any-valid-id>` (or complete the home form flow to reach pricing).

Verify:

- Clicking a navbar link shows the popup
- Clicking the "Full terms →" guarantee link shows the popup
- Clicking "Get Basic Report — $19" or "Get Premium Report — $25" does NOT show the popup
- Popup shows the headline: _"Before you go — your insurance company doesn't want you to have this."_
- Popup shows the subtext: _"The average settlement gap is $2,800..."_
- Clicking "Get My Report — $19" in the popup initiates the buy flow
- Clicking X or the backdrop navigates to the link you originally clicked
- Refreshing the page and clicking a link again does NOT show the popup (session gating)
- Opening a new tab / clearing sessionStorage allows the popup to show again

- [ ] **Step 4: Push and open PR**

```bash
git push -u origin feat/directory-auth-and-pricing-popup
```

Open a PR at `github.com/Lemmeyg/VehicleValuation` → verify the Vercel Preview URL → test the same QA steps on the preview before merging.
