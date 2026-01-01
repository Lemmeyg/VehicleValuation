# Vehicle Valuation SaaS

An independent vehicle valuation tool for total loss scenarios. Helps vehicle owners challenge insurance carrier settlement offers with comprehensive market data and comparable vehicles.

## 🚀 Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS + shadcn/ui
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth (email/password + magic links)
- **Payments**: LemonSqueezy
- **APIs**: MarketCheck (pricing), Auto.dev (VIN decode), VinAudit (VIN decode)
- **Testing**: Jest, React Testing Library, Playwright
- **Code Quality**: ESLint, Prettier, Husky
- **Security**: Row Level Security (RLS), HTTPS, Security Headers
- **Deployment**: Netlify

## 🌟 Features

- **Anonymous Report Creation**: Users can create reports without signup
- **VIN Validation**: Real-time VIN validation with checksum verification
- **Market-Based Pricing**: Uses MarketCheck API for accurate vehicle valuations
- **Comparable Vehicles**: Shows similar vehicles currently for sale
- **PDF Reports**: Professional PDF reports with full vehicle and market data
- **Secure Payments**: LemonSqueezy integration with webhook verification
- **Admin Dashboard**: Manage contact messages and view system stats
- **Rate Limiting**: Prevents abuse (1 report per user per 7 days)
- **Multi-Environment**: Dev/Staging/Production deployment strategy

## 📋 Prerequisites

Before you begin, ensure you have:

- **Node.js**: v20 or higher
- **npm**: v9 or higher
- **Git**: Latest version
- **Supabase Account**: Free tier available
- **LemonSqueezy Account**: For payment processing
- **API Keys**: MarketCheck, Auto.dev, VinAudit

## 🛠️ Setup Instructions

### 1. Clone the Repository

```bash
git clone <repository-url>
cd vehicle-valuation-saas
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Variables

Copy the example environment file and fill in your credentials:

```bash
cp .env.development.example .env.local
```

**Required Environment Variables:**

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# LemonSqueezy
LEMONSQUEEZY_API_KEY=your-api-key
LEMONSQUEEZY_STORE_ID=your-store-id
LEMONSQUEEZY_WEBHOOK_SECRET=your-webhook-secret
NEXT_PUBLIC_LEMONSQUEEZY_BASIC_VARIANT_ID=variant-id
NEXT_PUBLIC_LEMONSQUEEZY_PREMIUM_VARIANT_ID=variant-id

# Vehicle Data APIs
VINAUDIT_API_KEY=your-vinaudit-key
AUTODEV_API_KEY=your-autodev-key
MARKETCHECK_API_KEY=your-marketcheck-key

# App Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

See [.env.development.example](.env.development.example) for complete list.

### 4. Set Up Supabase

1. Create a project at [https://supabase.com](https://supabase.com)
2. Copy your project URL and keys to `.env.local`
3. Run database migrations:
   - Go to **SQL Editor** in Supabase dashboard
   - Run each migration in `supabase/migrations/` in order
   - Run `supabase/migrations/20260101000000_secure_admin_roles.sql` first
   - Run `supabase/migrations/20260101000001_fix_contact_messages_rls.sql`
   - Run `supabase/migrations/20260101000002_add_lemonsqueezy_payment_id.sql`

4. Grant admin access:
   ```sql
   -- Replace with your email
   INSERT INTO public.admins (user_id, notes)
   SELECT id, 'Initial admin user'
   FROM auth.users
   WHERE email = 'your-email@example.com';
   ```

### 5. Set Up LemonSqueezy

1. Create an account at [https://lemonsqueezy.com](https://lemonsqueezy.com)
2. Create two products:
   - **Basic Report**: $29
   - **Premium Report**: $49
3. Get your API key and store ID from settings
4. Create a webhook pointing to: `https://your-domain.com/api/lemonsqueezy/webhook`
5. Copy webhook secret to `.env.local`

### 6. Configure API Keys

Get API keys from:
- **VinAudit**: https://www.vinaudit.com/api-documentation
- **Auto.dev**: https://auto.dev/
- **MarketCheck**: https://www.marketcheck.com/api

### 7. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see your application.

## 🧪 Testing

### Unit Tests

```bash
# Run tests in watch mode
npm test

# Run tests with coverage (CI mode)
npm run test:ci

# Type checking
npm run type-check
```

**API Cost Protection**: All tests use mocks to prevent real API calls. See `__tests__/mocks/` for mock implementations.

### End-to-End Tests

```bash
# Run E2E tests
npm run test:e2e

# Run E2E tests with UI
npm run test:e2e:ui
```

## 🎨 Code Quality

### Linting & Formatting

```bash
# Run ESLint
npm run lint

# Format code with Prettier
npm run format

# Check formatting
npm run format:check
```

### Pre-commit Hooks

Husky runs `lint-staged` before every commit:
- ESLint with auto-fix on staged files
- Prettier formatting
- Ensures code quality

## 🔒 Security

### Security Features

- ✅ **Secure Admin Auth**: Database-backed admin roles (not user metadata)
- ✅ **Row Level Security**: All tables protected with RLS policies
- ✅ **Rate Limiting**: 1 report per user per 7 days
- ✅ **Payment Validation**: Reports require confirmed payment
- ✅ **Input Validation**: VIN, email, ZIP code validation
- ✅ **Security Headers**: HSTS, CSP, X-Frame-Options, etc.
- ✅ **Environment Validation**: Production safety checks

### Security Best Practices

**Never commit:**
- `.env.local` or any `.env.*` files (except examples)
- API keys or secrets
- Private keys (`.pem`, `.key` files)
- Credentials or tokens

See [SECURITY.md](SECURITY.md) for detailed security documentation.

## 📁 Project Structure

```
vehicle-valuation-saas/
├── app/                       # Next.js app directory
│   ├── api/                  # API routes
│   │   ├── auth/            # Authentication endpoints
│   │   ├── reports/         # Report management
│   │   ├── lemonsqueezy/   # Payment webhooks
│   │   └── contact/         # Contact form
│   ├── admin/               # Admin dashboard
│   ├── dashboard/           # User dashboard
│   └── layout.tsx           # Root layout
├── components/               # React components
│   ├── ui/                  # shadcn/ui components
│   └── [feature]/           # Feature-specific components
├── lib/                      # Shared utilities
│   ├── api/                 # API clients
│   ├── db/                  # Database utilities
│   ├── security/            # Security & validation
│   ├── services/            # Business logic
│   └── utils/               # Helper functions
├── __tests__/               # Test files
│   ├── mocks/               # API mocks
│   └── lib/                 # Unit tests
├── supabase/                # Database migrations
├── public/                  # Static assets
└── docs/                    # Documentation
```

## 🚢 Deployment

### Netlify Deployment (Recommended)

This project is configured for Netlify with three environments:

1. **Production** (main branch)
2. **Staging** (staging branch)
3. **Development** (dev branch)

See [DEPLOYMENT.md](DEPLOYMENT.md) for complete deployment guide.

**Quick Start:**

1. Push code to GitHub
2. Create three Netlify sites (prod, staging, dev)
3. Configure environment variables in Netlify
4. Deploy!

**Environment Variables in Netlify:**
- Go to **Site Settings** → **Environment Variables**
- Add all variables from `.env.production.example`
- Set `DISABLE_RATE_LIMIT=false` in production
- Set `DISABLE_PAYMENT_CHECK=false` in production

## 📖 Documentation

- **[DEPLOYMENT.md](DEPLOYMENT.md)**: Complete deployment guide
- **[SECURITY.md](SECURITY.md)**: Security documentation
- **[.env.production.example](.env.production.example)**: Production environment template
- **[.env.staging.example](.env.staging.example)**: Staging environment template
- **[.env.development.example](.env.development.example)**: Development environment template

## 🔧 Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run type-check` | TypeScript compiler check |
| `npm test` | Run Jest tests (watch mode) |
| `npm run test:ci` | Run tests with coverage |
| `npm run test:e2e` | Run Playwright E2E tests |
| `npm run test:e2e:ui` | E2E tests with UI |
| `npm run format` | Format code with Prettier |
| `npm run format:check` | Check code formatting |
| `npm run security:scan` | Semgrep security scan |

## 🐛 Troubleshooting

### Common Issues

**Issue**: `npm install` fails
- **Solution**: Delete `node_modules` and `package-lock.json`, then run `npm install`

**Issue**: Environment variables not loading
- **Solution**: Ensure `.env.local` exists and restart dev server

**Issue**: Supabase connection errors
- **Solution**: Verify Supabase URL and keys in `.env.local`
- **Solution**: Check Supabase project is not paused

**Issue**: LemonSqueezy webhook not working
- **Solution**: Use ngrok to forward webhooks locally: `ngrok http 3000`
- **Solution**: Verify webhook secret matches in `.env.local`

**Issue**: Rate limit blocking in development
- **Solution**: Set `DISABLE_RATE_LIMIT=true` in `.env.local`

**Issue**: Payment validation failing in development
- **Solution**: Set `DISABLE_PAYMENT_CHECK=true` in `.env.local`

**Issue**: Admin dashboard access denied
- **Solution**: Verify your user is in the `admins` table (see Setup step 4)

## 🏗️ Architecture

### Key Technologies

- **App Router**: Server components by default, client components where needed
- **Server Actions**: Form submissions and mutations
- **Supabase Auth**: Email/password + magic link authentication
- **RLS Policies**: Database-level security on all tables
- **Webhook Security**: HMAC signature verification for LemonSqueezy
- **PDF Generation**: Server-side PDF creation with @react-pdf/renderer

### Payment Flow

1. User enters VIN → Creates anonymous report
2. User enters email → Redirects to LemonSqueezy checkout
3. Payment confirmed → LemonSqueezy webhook triggered
4. Webhook calls MarketCheck API → Stores pricing data
5. PDF generated → User receives email with download link

### Security Architecture

- **Admin Roles**: Stored in `admins` table (service role access only)
- **RLS Policies**: Protect all user data and reports
- **Rate Limiting**: LRU cache-based, IP-identified
- **Environment Validation**: Production safeguards prevent dev flags

## 📞 Support

For issues and questions:

1. Check [DEPLOYMENT.md](DEPLOYMENT.md) for deployment issues
2. Check [SECURITY.md](SECURITY.md) for security questions
3. Review environment examples for configuration
4. Open an issue on GitHub

## 📄 License

[Add your license here]

---

**Built with Next.js 16, Supabase, and LemonSqueezy**
