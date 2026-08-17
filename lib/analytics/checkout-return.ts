/**
 * Checkout handoff marker.
 *
 * When a visitor is sent to LemonSqueezy we leave a note in their browser. If
 * they come back to the site without having bought, CheckoutReturnTracker finds
 * that note and records an abandonment. This is measured entirely on our side —
 * LemonSqueezy is never asked to redirect anywhere on cancel, and in fact the
 * cancelUrl computed in create-checkout/route.ts is never sent to their API at
 * all (lib/lemonsqueezy/client.ts only sends product_options.redirect_url).
 *
 * localStorage, not sessionStorage: the handoff is a full cross-domain
 * navigation and some browsers start a fresh session on return.
 */

const STORAGE_KEY = 'tlt_checkout_handoff'

/** Beyond this, a lingering marker is more likely stale than a real return. */
const MAX_AGE_MS = 6 * 60 * 60 * 1000

export interface CheckoutHandoff {
  reportId: string
  plan: 'basic' | 'premium'
  price: number
  at: number
}

export function markCheckoutHandoff(handoff: Omit<CheckoutHandoff, 'at'>): void {
  if (typeof window === 'undefined') return
  try {
    const record: CheckoutHandoff = { ...handoff, at: Date.now() }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(record))
  } catch {
    // Storage can be unavailable (private mode, quota). Losing the marker only
    // costs us one measurement — never break the purchase flow over it.
  }
}

export function readCheckoutHandoff(): CheckoutHandoff | null {
  if (typeof window === 'undefined') return null

  let raw: string | null
  try {
    raw = localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as CheckoutHandoff
    if (
      typeof parsed?.reportId !== 'string' ||
      typeof parsed?.at !== 'number' ||
      typeof parsed?.price !== 'number' ||
      (parsed?.plan !== 'basic' && parsed?.plan !== 'premium')
    ) {
      clearCheckoutHandoff()
      return null
    }
    if (Date.now() - parsed.at > MAX_AGE_MS) {
      clearCheckoutHandoff()
      return null
    }
    return parsed
  } catch {
    clearCheckoutHandoff()
    return null
  }
}

export function clearCheckoutHandoff(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Same reasoning as markCheckoutHandoff.
  }
}
