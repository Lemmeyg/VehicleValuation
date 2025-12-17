import { createHmac, timingSafeEqual } from 'crypto'
import type { CreateCheckoutParams, LemonSqueezyCheckoutResponse } from './types'

const LS_API_URL = 'https://api.lemonsqueezy.com/v1'

/**
 * Create a Lemon Squeezy checkout session
 * @param params Checkout parameters including variant ID, custom data, and redirect URLs
 * @returns Checkout session data including the checkout URL
 */
export async function createCheckout(
  params: CreateCheckoutParams
): Promise<LemonSqueezyCheckoutResponse> {
  const apiKey = process.env.LEMONSQUEEZY_API_KEY
  const storeId = process.env.LEMONSQUEEZY_STORE_ID

  if (!apiKey || !storeId) {
    throw new Error('Lemon Squeezy API credentials not configured')
  }

  const response = await fetch(`${LS_API_URL}/checkouts`, {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.api+json',
      'Content-Type': 'application/vnd.api+json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      data: {
        type: 'checkouts',
        attributes: {
          checkout_data: {
            custom: params.customData,
          },
          checkout_options: {
            button_color: '#2563eb', // Blue color matching your design
          },
          product_options: {
            enabled_variants: [parseInt(params.variantId)],
            redirect_url: params.successUrl,
          },
        },
        relationships: {
          store: {
            data: {
              type: 'stores',
              id: storeId,
            },
          },
          variant: {
            data: {
              type: 'variants',
              id: params.variantId,
            },
          },
        },
      },
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    console.error('Lemon Squeezy checkout creation failed:', error)
    throw new Error(`Failed to create checkout: ${response.statusText}`)
  }

  return response.json()
}

/**
 * Verify Lemon Squeezy webhook signature
 * @param rawBody The raw request body as a string
 * @param signature The X-Signature header value
 * @returns True if the signature is valid, false otherwise
 */
export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET

  if (!secret) {
    console.error('Lemon Squeezy webhook secret not configured')
    return false
  }

  try {
    const hmac = createHmac('sha256', secret)
    const digest = hmac.update(rawBody).digest('hex')

    // Use timing-safe comparison to prevent timing attacks
    return timingSafeEqual(Buffer.from(signature), Buffer.from(digest))
  } catch (error) {
    console.error('Webhook signature verification error:', error)
    return false
  }
}

/**
 * Get an order by ID from Lemon Squeezy
 * @param orderId The order ID
 * @returns Order data
 */
export async function getOrder(orderId: string) {
  const apiKey = process.env.LEMONSQUEEZY_API_KEY

  if (!apiKey) {
    throw new Error('Lemon Squeezy API key not configured')
  }

  const response = await fetch(`${LS_API_URL}/orders/${orderId}`, {
    method: 'GET',
    headers: {
      Accept: 'application/vnd.api+json',
      'Content-Type': 'application/vnd.api+json',
      Authorization: `Bearer ${apiKey}`,
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch order: ${response.statusText}`)
  }

  return response.json()
}
