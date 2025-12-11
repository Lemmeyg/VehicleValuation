# Stripe Payment Integration Setup Guide

This guide walks you through setting up Stripe payment processing for the Vehicle Valuation SaaS application.

## Table of Contents
1. [Create Stripe Account](#create-stripe-account)
2. [Get API Keys](#get-api-keys)
3. [Configure Environment Variables](#configure-environment-variables)
4. [Set Up Webhook Endpoint](#set-up-webhook-endpoint)
5. [Test Payment Flow](#test-payment-flow)
6. [Go Live Checklist](#go-live-checklist)

---

## Create Stripe Account

1. Go to [https://stripe.com](https://stripe.com)
2. Click "Sign Up" and create a free account
3. Complete the onboarding process
4. You'll start in **Test Mode** by default (perfect for development)

---

## Get API Keys

### Development (Test Mode)

1. Log in to your Stripe Dashboard
2. Make sure you're in **Test Mode** (toggle in the sidebar)
3. Navigate to **Developers → API keys**
4. You'll see two keys:
   - **Publishable key** - Starts with `pk_test_...`
   - **Secret key** - Starts with `sk_test_...` (click "Reveal test key")

### Production (Live Mode)

When ready to go live:

1. Switch to **Live Mode** in the Stripe Dashboard
2. Navigate to **Developers → API keys**
3. Copy your live keys:
   - **Publishable key** - Starts with `pk_live_...`
   - **Secret key** - Starts with `sk_live_...`

---

## Configure Environment Variables

### Update `.env.local`

Add the following variables to your `.env.local` file:

```bash
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxxxxxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxx
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Existing Supabase config (don't remove)
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxxxxxxxxxxxxxxxxxxxx
```

### Variable Descriptions

| Variable | Description | Example |
|----------|-------------|---------|
| `STRIPE_SECRET_KEY` | Server-side Stripe API key | `sk_test_51H...` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Client-side publishable key | `pk_test_51H...` |
| `STRIPE_WEBHOOK_SECRET` | Webhook signing secret (see below) | `whsec_xxx...` |
| `NEXT_PUBLIC_APP_URL` | Your application URL | `http://localhost:3000` |

**Important Notes:**
- Use **test keys** (`sk_test_` and `pk_test_`) during development
- Use **live keys** (`sk_live_` and `pk_live_`) in production
- Never commit `.env.local` to version control (it's in `.gitignore`)

---

## Set Up Webhook Endpoint

Stripe webhooks notify your app when payment events occur (e.g., successful payment).

### Development Setup (Using Stripe CLI)

For local development, use the Stripe CLI to forward webhook events:

1. **Install Stripe CLI**:
   - macOS: `brew install stripe/stripe-cli/stripe`
   - Windows: Download from [https://stripe.com/docs/stripe-cli](https://stripe.com/docs/stripe-cli)
   - Linux: See [installation docs](https://stripe.com/docs/stripe-cli)

2. **Authenticate CLI**:
   ```bash
   stripe login
   ```

3. **Forward Webhooks to Local Server**:
   ```bash
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```

4. **Copy Webhook Secret**:
   The CLI will output a webhook signing secret like:
   ```
   > Ready! Your webhook signing secret is whsec_xxxxxxxxxxxxxxxxxxxxx
   ```
   Copy this and add it to `.env.local` as `STRIPE_WEBHOOK_SECRET`

5. **Keep CLI Running**:
   Keep the Stripe CLI terminal window open while developing. It will show webhook events in real-time.

### Production Setup

When deploying to production:

1. **Deploy Your App** to production (e.g., Vercel, AWS, etc.)

2. **Add Webhook Endpoint in Stripe Dashboard**:
   - Go to **Developers → Webhooks**
   - Click **Add endpoint**
   - Enter your webhook URL: `https://yourdomain.com/api/stripe/webhook`
   - Select events to listen for:
     - `checkout.session.completed`
     - `payment_intent.succeeded`
     - `payment_intent.payment_failed`
   - Click **Add endpoint**

3. **Get Webhook Signing Secret**:
   - After creating the endpoint, click on it
   - Click **Reveal** under "Signing secret"
   - Copy the secret (starts with `whsec_`)
   - Add it to your production environment variables

---

## Test Payment Flow

### Using Test Cards

Stripe provides test card numbers for development:

| Card Number | Scenario |
|-------------|----------|
| `4242 4242 4242 4242` | Successful payment |
| `4000 0000 0000 9995` | Payment declined |
| `4000 0025 0000 3155` | Requires authentication (3D Secure) |

**Test Card Details:**
- Any future expiration date (e.g., `12/34`)
- Any 3-digit CVC (e.g., `123`)
- Any postal code (e.g., `12345`)

### Testing Steps

1. **Start Development Server**:
   ```bash
   npm run dev
   ```

2. **Start Stripe CLI** (in separate terminal):
   ```bash
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```

3. **Test the Flow**:
   - Navigate to [http://localhost:3000](http://localhost:3000)
   - Sign up / Log in
   - Create a new report with a VIN (e.g., `1HGBH41JXMN109186`)
   - Click "Basic Report - $29" or "Premium Report - $49"
   - Use test card `4242 4242 4242 4242`
   - Complete checkout
   - Verify redirect to success page
   - Check Stripe CLI terminal for webhook events

4. **Verify in Database**:
   - Check Supabase `payments` table for new record
   - Check `reports` table - `price_paid` should be updated
   - Check `status` changed from `draft` to `pending`

5. **View in Stripe Dashboard**:
   - Go to **Payments** tab
   - You should see your test payment

---

## Go Live Checklist

Before switching to live mode:

- [ ] Complete Stripe account activation (provide business details)
- [ ] Replace test API keys with live keys in production environment
- [ ] Set up production webhook endpoint in Stripe Dashboard
- [ ] Update `NEXT_PUBLIC_APP_URL` to production URL
- [ ] Test full payment flow in live mode with real card
- [ ] Set up proper error logging/monitoring
- [ ] Review Stripe pricing at [https://stripe.com/pricing](https://stripe.com/pricing)
- [ ] Set up email notifications for successful payments
- [ ] Configure payout schedule in Stripe Dashboard
- [ ] Add proper customer support contact information

---

## Pricing Structure

Current pricing configured in [lib/stripe/stripe-client.ts](lib/stripe/stripe-client.ts:14-17):

| Report Type | Price | Stripe Fee (2.9% + $0.30) | Net Revenue |
|-------------|-------|----------------------------|-------------|
| Basic | $29.00 | $1.14 | $27.86 |
| Premium | $49.00 | $1.72 | $47.28 |

To change prices, update `REPORT_PRICES` in `lib/stripe/stripe-client.ts`.

---

## Webhook Events Handled

The webhook handler in [app/api/stripe/webhook/route.ts](app/api/stripe/webhook/route.ts:48-66) processes:

1. **`checkout.session.completed`** - When user completes payment
   - Creates payment record in `payments` table
   - Updates report with `price_paid` and changes status to `pending`

2. **`payment_intent.succeeded`** - Payment processing succeeded
   - Updates payment record status to `succeeded`

3. **`payment_intent.payment_failed`** - Payment failed
   - Updates payment record status to `failed`

---

## Troubleshooting

### "Invalid API Key" Error

- Verify you're using the correct key format (`sk_test_...` or `sk_live_...`)
- Check for extra spaces or newlines in `.env.local`
- Restart your dev server after updating environment variables

### "No signatures found" Webhook Error

- Make sure Stripe CLI is running with `stripe listen --forward-to localhost:3000/api/stripe/webhook`
- Verify `STRIPE_WEBHOOK_SECRET` in `.env.local` matches CLI output
- Check that the secret starts with `whsec_`

### Payment Succeeds but Database Not Updated

- Check Stripe CLI terminal for webhook delivery errors
- Verify Supabase credentials are correct
- Check server logs for errors in webhook handler
- Ensure `payments` and `reports` tables exist with correct schemas

### Test Cards Not Working

- Ensure you're using **test mode** API keys (not live keys)
- Verify card number is exactly `4242 4242 4242 4242` with spaces
- Use any future expiration date and any 3-digit CVC

---

## Additional Resources

- [Stripe Testing Documentation](https://stripe.com/docs/testing)
- [Stripe Webhooks Guide](https://stripe.com/docs/webhooks)
- [Stripe CLI Documentation](https://stripe.com/docs/stripe-cli)
- [Stripe Dashboard](https://dashboard.stripe.com)

---

## Support

If you encounter issues:

1. Check the [Stripe Documentation](https://stripe.com/docs)
2. Review server logs for error messages
3. Test with Stripe's provided test cards
4. Check webhook event logs in Stripe Dashboard
5. Verify all environment variables are set correctly

---

**Last Updated:** December 2025
