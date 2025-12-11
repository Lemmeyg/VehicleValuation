# Vehicle Valuation SaaS - MVP

An independent vehicle valuation tool for total loss scenarios. Helps vehicle owners challenge insurance carrier settlement offers with comprehensive market data and comparable vehicles.

## 🚀 Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS + shadcn/ui
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Payments**: Stripe
- **Testing**: Jest, React Testing Library, Playwright
- **Code Quality**: ESLint, Prettier, Husky
- **Security**: Semgrep (CI/CD)
- **Deployment**: Vercel

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js**: v18 or higher
- **npm**: v9 or higher
- **Git**: Latest version

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
cp .env.example .env.local
```

**Required Environment Variables:**

See [INPUTS.md](../INPUTS.md) for detailed instructions on obtaining all required API keys and credentials.

### 4. Set Up Supabase

1. Create a project at [https://supabase.com](https://supabase.com)
2. Copy your project URL and anon key to `.env.local`
3. Run database migrations (coming in Phase 2)

### 5. Set Up Stripe

1. Create an account at [https://stripe.com](https://stripe.com)
2. Get your test mode API keys from the dashboard
3. Create two products:
   - **Basic Report**: $29
   - **Premium Report**: $49
4. Copy the price IDs to `.env.local`

### 6. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see your application.

## 🧪 Testing

### Unit & Integration Tests

```bash
# Run tests in watch mode
npm run test

# Run tests with coverage
npm run test:ci

# Type checking
npm run type-check
```

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

Husky is configured to run lint-staged before every commit, which:

- Runs ESLint with auto-fix on staged `.ts`, `.tsx`, `.js`, `.jsx` files
- Runs Prettier on staged files
- Ensures code quality before commits

## 🔒 Security

### Security Scanning

```bash
# Run security scan (Semgrep)
npm run security:scan
```

**Important**: Never commit:

- `.env.local` or any `.env.*` files except `.env.example`
- API keys or secrets
- Private keys (`.pem`, `.key` files)

## 📁 Project Structure

```
vehicle-valuation-saas/
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   │   ├── auth/         # Authentication endpoints
│   │   ├── reports/      # Report management endpoints
│   │   ├── payments/     # Stripe payment endpoints
│   │   └── webhooks/     # Stripe webhook handlers
│   ├── dashboard/        # Dashboard pages
│   └── layout.tsx        # Root layout
├── components/            # React components
│   ├── ui/               # shadcn/ui components
│   ├── auth/             # Authentication components
│   ├── dashboard/        # Dashboard components
│   ├── forms/            # Form components
│   └── report/           # Report components
├── lib/                   # Shared utilities
│   ├── api/              # API clients (VinAudit, Auto.dev, etc.)
│   ├── db/               # Database utilities
│   ├── validations/      # Zod schemas
│   └── utils/            # Helper functions
├── types/                 # TypeScript type definitions
├── hooks/                 # Custom React hooks
├── e2e/                   # Playwright E2E tests
└── public/                # Static assets
```

## 🚢 Deployment

### Vercel Deployment

1. Push your code to GitHub
2. Import project in Vercel dashboard
3. Add environment variables in Vercel project settings
4. Deploy!

See [PRD.md](../PRD.md) for detailed deployment instructions.

## 📖 Documentation

- **[PRD.md](../PRD.md)**: Complete product requirements document
- **[INPUTS.md](../INPUTS.md)**: Required credentials and setup guide
- **[Implementation Plan](../.claude/plans/)**: Detailed development roadmap

## 🔧 Available Scripts

| Script                  | Description                   |
| ----------------------- | ----------------------------- |
| `npm run dev`           | Start development server      |
| `npm run build`         | Build for production          |
| `npm start`             | Start production server       |
| `npm run lint`          | Run ESLint                    |
| `npm run type-check`    | Run TypeScript compiler check |
| `npm test`              | Run Jest tests in watch mode  |
| `npm run test:ci`       | Run tests with coverage (CI)  |
| `npm run test:e2e`      | Run Playwright E2E tests      |
| `npm run test:e2e:ui`   | Run E2E tests with UI         |
| `npm run format`        | Format code with Prettier     |
| `npm run format:check`  | Check code formatting         |
| `npm run security:scan` | Run Semgrep security scan     |

## 🐛 Troubleshooting

### Common Issues

**Issue**: `npm install` fails

- **Solution**: Delete `node_modules` and `package-lock.json`, then run `npm install` again

**Issue**: Environment variables not loading

- **Solution**: Ensure `.env.local` exists and restart dev server

**Issue**: Supabase connection errors

- **Solution**: Verify your Supabase URL and keys in `.env.local`

**Issue**: Stripe webhook not working locally

- **Solution**: Use Stripe CLI to forward webhooks: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`

## 📞 Support

For issues and questions:

1. Check existing documentation
2. Review [INPUTS.md](../INPUTS.md) for setup issues
3. Open an issue on GitHub

## 📄 License

[Add your license here]

---


