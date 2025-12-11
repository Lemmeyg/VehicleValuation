# Vehicle Valuation SaaS

A comprehensive vehicle valuation platform that provides instant, accurate market valuations and accident history reports for used vehicles. Built with Next.js 16, Supabase, and Stripe.

## Features

### User Features
- 🚗 **VIN Validation** - Validate and decode 17-character VINs
- 📊 **Market Valuation** - Get low, average, and high market values
- 🔍 **Accident History** - Premium reports include detailed accident records
- 📄 **PDF Reports** - Professional PDF reports generated automatically
- 💳 **Secure Payments** - Stripe integration for Basic ($29) and Premium ($49) reports
- 📥 **Instant Download** - Download reports immediately after payment

### Admin Features
- 📈 **Analytics Dashboard** - Real-time statistics and KPIs
- 📋 **Report Management** - View, filter, and manage all reports
- 💰 **Payment Tracking** - Monitor revenue and payment status
- 👥 **User Analytics** - Track user activity and lifetime value
- 🔄 **PDF Regeneration** - Manually trigger PDF generation if needed
- 🔗 **Stripe Integration** - Direct links to Stripe Dashboard

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript
- **Database:** Supabase (PostgreSQL)
- **Authentication:** Supabase Auth
- **Storage:** Supabase Storage
- **Payments:** Stripe Checkout
- **PDF Generation:** @react-pdf/renderer
- **Styling:** Tailwind CSS

## Project Structure

```
vehicle-valuation-saas/
├── app/
│   ├── (auth)/              # Authentication pages
│   │   ├── login/
│   │   └── signup/
│   ├── admin/               # Admin dashboard
│   │   ├── reports/         # Reports management
│   │   ├── payments/        # Payments management
│   │   └── users/           # Users management
│   ├── api/
│   │   ├── reports/         # Report APIs
│   │   └── stripe/          # Stripe APIs (checkout, webhook)
│   ├── dashboard/           # User dashboard
│   └── reports/             # Report pages
│       ├── new/             # Create new report
│       └── [id]/            # Report details
├── lib/
│   ├── api/                 # External API clients
│   ├── db/                  # Database utilities
│   ├── pdf/                 # PDF templates
│   ├── services/            # Business logic
│   └── stripe/              # Stripe configuration
├── database-setup.sql       # Database initialization
└── .env.local              # Environment variables
```

## Prerequisites

Before you begin, ensure you have:

- Node.js 18+ installed
- A Supabase account
- A Stripe account
- Git installed

## Quick Start

### 1. Clone the Repository

```bash
git clone <repository-url>
cd vehicle-valuation-saas
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the complete setup script:
   ```bash
   # Copy contents of database-setup.sql and run in Supabase SQL Editor
   ```
3. Go to **Storage** and create a bucket:
   - Bucket name: `vehicle-reports`
   - Public bucket: YES
4. Go to **Settings → API** and copy:
   - Project URL
   - `anon` public key
   - `service_role` secret key

### 4. Set Up Stripe

1. Create account at [stripe.com](https://stripe.com)
2. Stay in **Test Mode**
3. Go to **Developers → API keys** and copy:
   - Publishable key (starts with `pk_test_`)
   - Secret key (starts with `sk_test_`)
4. Install Stripe CLI:
   ```bash
   # macOS
   brew install stripe/stripe-cli/stripe

   # Windows
   # Download from https://stripe.com/docs/stripe-cli
   ```
5. Authenticate CLI:
   ```bash
   stripe login
   ```

### 5. Configure Environment Variables

Create `.env.local` in the project root:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_your_key_here
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 6. Start Development Server

**Terminal 1 - Next.js:**
```bash
npm run dev
```

**Terminal 2 - Stripe Webhook Forwarding:**
```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Copy the webhook signing secret from the Stripe CLI output and add it to `.env.local` as `STRIPE_WEBHOOK_SECRET`.

### 7. Create Admin User

1. Sign up at http://localhost:3000/signup
2. In Supabase Dashboard → **Authentication → Users**
3. Click on your user → **Edit User Metadata**
4. Add JSON:
   ```json
   {
     "is_admin": true
   }
   ```
5. Save and refresh the page

### 8. Test the Application

1. Navigate to http://localhost:3000
2. Sign in with your admin user
3. Create a new report with VIN: `1HGBH41JXMN109186`
4. Complete payment with test card: `4242 4242 4242 4242`
5. Download the generated PDF
6. Access admin dashboard at http://localhost:3000/admin

## Testing with Stripe

### Test Card Numbers

| Card Number | Scenario |
|-------------|----------|
| 4242 4242 4242 4242 | Successful payment |
| 4000 0000 0000 9995 | Payment declined |
| 4000 0025 0000 3155 | Requires 3D Secure |

**Card Details:**
- Expiry: Any future date (e.g., `12/34`)
- CVC: Any 3 digits (e.g., `123`)
- ZIP: Any 5 digits (e.g., `12345`)

## Deployment

### Deploy to Vercel

1. Push code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Import your repository
4. Add environment variables (same as `.env.local` but use production Stripe keys)
5. Deploy

### Configure Production Stripe Webhook

1. Go to Stripe Dashboard → **Developers → Webhooks**
2. Click **Add endpoint**
3. Enter: `https://yourdomain.com/api/stripe/webhook`
4. Select events:
   - `checkout.session.completed`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
5. Copy the webhook signing secret
6. Add to Vercel environment variables as `STRIPE_WEBHOOK_SECRET`

### Switch to Live Mode

1. In Stripe Dashboard, toggle to **Live Mode**
2. Get live API keys from **Developers → API keys**
3. Update Vercel environment variables:
   - `STRIPE_SECRET_KEY=sk_live_...`
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...`
   - `STRIPE_WEBHOOK_SECRET=whsec_...` (from production webhook)
4. Redeploy

## API Documentation

### Report Creation
```typescript
POST /api/reports/create
Body: { vin: string }
Response: { id: string, vin: string, ... }
```

### Payment Checkout
```typescript
POST /api/stripe/create-checkout
Body: { reportId: string, reportType: 'BASIC' | 'PREMIUM' }
Response: { url: string }
```

### PDF Generation
```typescript
POST /api/reports/[id]/generate-pdf
Response: { pdfUrl: string }
```

### Webhook Handler
```typescript
POST /api/stripe/webhook
Headers: { stripe-signature: string }
Body: Stripe Event
```

## Database Schema

### reports
```sql
- id (UUID, PK)
- user_id (UUID, FK → auth.users)
- vin (VARCHAR(17))
- vehicle_data (JSONB)
- accident_details (JSONB)
- valuation_result (JSONB)
- price_paid (INTEGER) -- cents
- stripe_payment_id (TEXT)
- pdf_url (TEXT)
- status (TEXT) -- draft, pending, completed, failed
- created_at (TIMESTAMPTZ)
- updated_at (TIMESTAMPTZ)
```

### payments
```sql
- id (UUID, PK)
- report_id (UUID, FK → reports)
- user_id (UUID, FK → auth.users)
- stripe_payment_id (TEXT)
- stripe_payment_intent_id (TEXT)
- amount (INTEGER) -- cents
- status (TEXT) -- pending, succeeded, failed, refunded
- metadata (JSONB)
- created_at (TIMESTAMPTZ)
- updated_at (TIMESTAMPTZ)
```

## Pricing

- **Basic Report:** $29
  - Vehicle Information
  - Market Valuation (Low/Average/High)
  - Money-Back Guarantee

- **Premium Report:** $49
  - Everything in Basic
  - Accident History
  - Market Comparables
  - Priority Processing

## Costs

### Stripe Fees
- 2.9% + $0.30 per successful charge
- Basic ($29): $1.14 fee, $27.86 net
- Premium ($49): $1.72 fee, $47.28 net

### Supabase (Free Tier)
- 500MB database
- 1GB file storage
- 2GB bandwidth
- 50,000 monthly active users

### APIs (Mock Data)
- Currently using mock data
- Ready for integration with:
  - VinAudit API
  - Auto.dev API
  - CarsXE API

## Troubleshooting

### "Module not found" errors
```bash
npm install
npm run dev
```

### Stripe webhook not firing
1. Ensure Stripe CLI is running
2. Check webhook secret in `.env.local`
3. Restart dev server

### PDF not generating
1. Verify Supabase Storage bucket exists (`vehicle-reports`)
2. Check RLS policies are applied
3. Check console for errors

### Admin dashboard redirects
1. Verify user has `is_admin: true` in metadata
2. Sign out and sign back in
3. Check browser console for errors

## Documentation

- [Phase 4: Stripe Integration](PHASE4_COMPLETE.md)
- [Phase 5A: PDF Generation](PHASE5A_COMPLETE.md)
- [Phase 5B: Admin Dashboard](PHASE5B_COMPLETE.md)
- [Supabase Storage Setup](SUPABASE_STORAGE_SETUP.md)
- [Stripe Setup Guide](STRIPE_SETUP.md)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For issues and questions:
1. Check the documentation
2. Review troubleshooting section
3. Open an issue on GitHub

## Roadmap

- [ ] Email notifications
- [ ] Refund processing
- [ ] Advanced analytics
- [ ] Bulk PDF generation
- [ ] Export to CSV
- [ ] Live API integration
- [ ] Mobile app

---

Built with ❤️ using Next.js, Supabase, and Stripe
