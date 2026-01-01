# Lemon Squeezy Integration Setup Guide

This guide will help you set up Lemon Squeezy as your payment processor for the Vehicle Valuation SaaS application.

## Overview

Lemon Squeezy has been integrated as your primary payment processor, replacing Stripe. This gives you:

- ✅ **Faster Setup**: 24-48 hour verification (vs. days with bank account setup)
- ✅ **Tax Compliance**: Automatic worldwide sales tax handling
- ✅ **Fraud Protection**: Built-in AI-powered fraud detection
- ✅ **Merchant of Record**: They handle all compliance and tax remittance
- ⚠️ **Higher Fees**: 5% + $0.50 per transaction (vs Stripe's 2.9% + $0.30)

**Cost Comparison:**

- Basic Report ($29): $1.95 with Lemon Squeezy vs $1.14 with Stripe
- Premium Report ($49): $2.95 with Lemon Squeezy vs $1.72 with Stripe
- **Extra cost is worth it** for included tax compliance and faster setup

---

## Step 1: Create Lemon Squeezy Account

1. Go to https://lemonsqueezy.com
2. Click "Sign Up" and create your account
3. Complete the onboarding process
4. **Upload government-issued ID for verification**
   - This triggers the 24-48 hour verification process
   - You'll receive an email when approved

---

## Step 2: Create Your Products

Once your account is approved:

### Product 1: Basic Report ($29)

1. Go to **Products** → **New Product**
2. Fill in details:
   - **Name**: Vehicle Valuation Report - Basic
   - **Description**: Comprehensive vehicle information and market valuation with money-back guarantee
   - **Price**: $29 USD
   - **Type**: Single Purchase (not subscription)
3. Click **Create Product**
4. **Copy the Variant ID** from the product page (you'll need this later)

### Product 2: Premium Report ($49)

1. Create another product with:
   - **Name**: Vehicle Valuation Report - Premium
   - **Description**: Everything in Basic plus accident history, market comparables, and priority processing
   - **Price**: $49 USD
   - **Type**: Single Purchase
2. **Copy the Variant ID**

---

## Step 3: Get API Credentials

1. Go to **Settings** → **API** in your Lemon Squeezy dashboard
2. Click **Create API Key**
   - **Name**: Vehicle Valuation SaaS
   - **Permissions**: Full Access (required for checkout creation)
3. **Copy the API Key** (starts with `lmsk_...`)
4. Find your **Store ID**:
   - Go to **Settings** → **Stores**
   - Copy the numeric Store ID

---

## Step 4: Set Up Webhooks

1. Go to **Settings** → **Webhooks**
2. Click **Add Endpoint**
3. Configure:
   - **URL**: `https://yourdomain.com/api/lemonsqueezy/webhook`
     - For local testing: Use ngrok or similar to expose localhost
   - **Events to Listen For**:
     - ✅ `order_created`
     - ✅ `order_refunded`
   - **Signing Secret**: Will be auto-generated
4. **Copy the Signing Secret** (starts with `whsec_...`)

---

## Step 5: Configure Environment Variables

1. Open your `.env.local` file
2. Add the following variables:

```bash
# Lemon Squeezy Configuration
LEMONSQUEEZY_API_KEY=lmsk_your_api_key_here
LEMONSQUEEZY_STORE_ID=12345
LEMONSQUEEZY_WEBHOOK_SECRET=whsec_your_webhook_secret_here

# Product Variant IDs
NEXT_PUBLIC_LEMONSQUEEZY_BASIC_VARIANT_ID=123456
NEXT_PUBLIC_LEMONSQUEEZY_PREMIUM_VARIANT_ID=123457
```

3. Replace with your actual values from Steps 2-4

---

## Step 6: Add Bank Account for Payouts

1. Go to **Settings** → **Payouts**
2. Click **Add Bank Account**
3. Enter your bank details:
   - **U.S. Banks**: ACH (no fees)
   - **International**: Wire transfer or local payment methods
4. Set payout frequency (monthly by default)

**Note**: This can be done later - it's only required when you want to withdraw funds.

---

## Step 7: Test the Integration

### Local Testing with Test Mode

1. Start your development server:

   ```bash
   npm run dev
   ```

2. Create a test report:
   - Go to http://localhost:3000
   - Create a new vehicle valuation report
   - Proceed to payment page

3. Click "Select Basic" or "Select Premium"
   - You should be redirected to Lemon Squeezy checkout
   - In test mode, use test card: **4242 4242 4242 4242**

4. Complete the test payment

5. Verify webhook received:
   - Check your console logs for "Received Lemon Squeezy webhook: order_created"
   - Check database for new payment record
   - Check that PDF was generated

---

## Step 8: Deploy to Production

### Vercel Deployment

1. Push code to GitHub (if not already done)

2. Go to Vercel Dashboard → Your Project → Settings → Environment Variables

3. Add all Lemon Squeezy variables:

   ```
   LEMONSQUEEZY_API_KEY
   LEMONSQUEEZY_STORE_ID
   LEMONSQUEEZY_WEBHOOK_SECRET
   NEXT_PUBLIC_LEMONSQUEEZY_BASIC_VARIANT_ID
   NEXT_PUBLIC_LEMONSQUEEZY_PREMIUM_VARIANT_ID
   ```

4. Update webhook URL in Lemon Squeezy:
   - Go to Lemon Squeezy → Settings → Webhooks
   - Edit your webhook endpoint
   - Change URL to: `https://yourdomain.com/api/lemonsqueezy/webhook`

5. Redeploy your app:
   ```bash
   git push origin main
   ```

---

## Troubleshooting

### Webhook Not Receiving Events

**Problem**: Payment completes but PDF not generated

**Solutions**:

1. Check webhook URL is correct in Lemon Squeezy dashboard
2. Verify webhook secret matches your `.env.local`
3. Check server logs for webhook errors
4. Test webhook manually using Lemon Squeezy dashboard's "Send Test Event"

### Payment Creates but No Redirect

**Problem**: User stuck on checkout page

**Solutions**:

1. Verify variant IDs are correct
2. Check that success URL is properly formatted
3. Ensure NEXT_PUBLIC_APP_URL is set correctly

### Invalid API Key Error

**Problem**: "Lemon Squeezy API credentials not configured"

**Solutions**:

1. Verify LEMONSQUEEZY_API_KEY is set in `.env.local`
2. Check API key has "Full Access" permissions
3. Restart dev server after adding environment variables

---

## Files Created/Modified

### New Files (4):

1. `lib/lemonsqueezy/types.ts` - TypeScript type definitions
2. `lib/lemonsqueezy/client.ts` - API wrapper functions
3. `app/api/lemonsqueezy/create-checkout/route.ts` - Checkout creation endpoint
4. `app/api/lemonsqueezy/webhook/route.ts` - Webhook handler

### Modified Files (3):

1. `lib/env.ts` - Added Lemon Squeezy environment variables
2. `app/reports/[id]/payment-buttons.tsx` - Switched from Stripe to Lemon Squeezy
3. `.env.example` - Updated with Lemon Squeezy configuration

---

## Next Steps

1. ✅ Complete Lemon Squeezy account verification (24-48 hours)
2. ✅ Create products and copy variant IDs
3. ✅ Add environment variables to `.env.local`
4. ✅ Test locally with test payments
5. ✅ Deploy to production
6. ✅ Add bank account for payouts (can be done later)
7. ✅ Monitor first real payments in Lemon Squeezy dashboard

---

## Support

- **Lemon Squeezy Docs**: https://docs.lemonsqueezy.com
- **API Reference**: https://docs.lemonsqueezy.com/api
- **Support**: https://lemonsqueezy.com/support
- **Test Cards**: https://docs.lemonsqueezy.com/help/getting-started/test-mode

---

## Migration Back to Stripe (If Needed)

If you decide to switch back to Stripe later:

1. Keep all Lemon Squeezy code (it's isolated in `lib/lemonsqueezy/` and `app/api/lemonsqueezy/`)
2. Uncomment Stripe environment variables in `.env.local`
3. Update `payment-buttons.tsx` to point back to `/api/stripe/create-checkout`
4. Both payment processors can coexist if needed

---

**You're all set!** The Lemon Squeezy integration is complete and ready to accept payments as soon as your account is verified.
