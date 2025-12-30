// Lemon Squeezy API Types
// Documentation: https://docs.lemonsqueezy.com/api

export interface LemonSqueezyCheckoutData {
  reportId: string
  userId: string
  reportType: 'BASIC' | 'PREMIUM'
}

export interface LemonSqueezyCheckoutResponse {
  data: {
    id: string
    type: 'checkouts'
    attributes: {
      url: string
      store_id: number
      variant_id: number
      custom_price: number | null
      product_options: {
        name: string
        description: string | null
        media: string[]
        redirect_url: string
        receipt_button_text: string
        receipt_link_url: string
        receipt_thank_you_note: string
        enabled_variants: number[]
      }
      checkout_options: {
        embed: boolean
        media: boolean
        logo: boolean
        desc: boolean
        discount: boolean
        dark: boolean
        subscription_preview: boolean
        button_color: string
      }
      checkout_data: {
        email: string | null
        name: string | null
        billing_address: Record<string, unknown> | null
        tax_number: string | null
        discount_code: string | null
        custom: LemonSqueezyCheckoutData
        variant_quantities: Array<{ variant_id: number; quantity: number }>
      }
      preview: {
        currency: string
        currency_rate: number
        subtotal: number
        discount_total: number
        tax: number
        total: number
        subtotal_usd: number
        discount_total_usd: number
        tax_usd: number
        total_usd: number
        subtotal_formatted: string
        discount_total_formatted: string
        tax_formatted: string
        total_formatted: string
      }
      expires_at: string | null
      created_at: string
      updated_at: string
      test_mode: boolean
    }
  }
}

export interface LemonSqueezyWebhookEvent {
  meta: {
    event_name: string
    custom_data: LemonSqueezyCheckoutData
    webhook_id: string
    test_mode: boolean
  }
  data: {
    type: 'orders'
    id: string
    attributes: {
      store_id: number
      customer_id: number
      identifier: string
      order_number: number
      user_name: string
      user_email: string
      currency: string
      currency_rate: string
      subtotal: number
      discount_total: number
      tax: number
      total: number
      subtotal_usd: number
      discount_total_usd: number
      tax_usd: number
      total_usd: number
      tax_name: string
      tax_rate: string
      status: 'pending' | 'paid' | 'refunded' | 'failed'
      status_formatted: string
      refunded: boolean
      refunded_at: string | null
      subtotal_formatted: string
      discount_total_formatted: string
      tax_formatted: string
      total_formatted: string
      first_order_item: {
        id: number
        order_id: number
        product_id: number
        variant_id: number
        product_name: string
        variant_name: string
        price: number
        created_at: string
        updated_at: string
        test_mode: boolean
      }
      urls: {
        receipt: string
      }
      created_at: string
      updated_at: string
      test_mode: boolean
    }
  }
}

export interface CreateCheckoutParams {
  variantId: string
  customData: LemonSqueezyCheckoutData
  successUrl: string
  cancelUrl: string
}
