# Required Inputs for Vehicle Valuation SaaS MVP

This document contains all the information you need to provide to keep the project moving forward. Fill in the values as you obtain them during Phase 1 setup.

---

## Phase 1: Account Setup

### 1. Supabase

**Action**: Create account at https://supabase.com

**Required Information**:
```
SUPABASE_PROJECT_NAME: vehicle-valuation-mvp
SUPABASE_REGION: (Choose closest to your users, e.g., us-east-1)

# After project creation, you'll get:
NEXT_PUBLIC_SUPABASE_URL: https://[project-id].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY: eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY: eyJhbGc... (KEEP SECRET!)
```

**Where to add**:
- Project `.env.local` file
- `~/.claude/settings.json` (for Supabase MCP)
- Vercel environment variables (production)

---

### 2. Stripe

**Action**: Create account at https://stripe.com

**Required Information**:
```
STRIPE_ACCOUNT_EMAIL: your-email@example.com

# After account creation:
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: pk_test_...
STRIPE_SECRET_KEY: sk_test_... (KEEP SECRET!)

# After creating products (do this in Stripe Dashboard):
STRIPE_PRICE_ID_29: price_... (for $29 report)
STRIPE_PRICE_ID_49: price_... (for $49 report)

# After setting up webhooks (will do in Phase 5):
STRIPE_WEBHOOK_SECRET: whsec_... (KEEP SECRET!)
```

**Where to add**:
- Project `.env.local` file
- Vercel environment variables (production)

---

### 3. Vercel

**Action**: Create account at https://vercel.com

**Required Information**:
```
VERCEL_ACCOUNT_EMAIL: your-email@example.com
VERCEL_PROJECT_NAME: vehicle-valuation-saas

# After connecting GitHub repo:
VERCEL_GIT_REPO: your-github-username/vehicle-valuation-saas
```

**Note**: Vercel will auto-detect Next.js and configure build settings.

---

### 4. GitHub

**Action**: Create account at https://github.com (if you don't have one)

**Required Information**:
```
GITHUB_USERNAME: your-username
GITHUB_REPO_NAME: vehicle-valuation-saas
```

**MCP OAuth Setup**:
- Run `/mcp` command in Claude Code
- Select GitHub
- Complete OAuth flow in browser

---

### 5. Linear (Optional - for bug tracking)

**Action**: Create account at https://linear.app

**Required Information**:
```
LINEAR_WORKSPACE_NAME: Vehicle Valuation
LINEAR_PROJECT_NAME: MVP Development

# After OAuth (will do via /mcp command):
LINEAR_TEAM_ID: (auto-configured via OAuth)
```

**MCP OAuth Setup**:
- Run `/mcp` command in Claude Code
- Select Linear
- Complete OAuth flow in browser

---

### 6. Google Analytics 4

**Action**: Create account at https://analytics.google.com

**Required Information**:
```
GA4_PROPERTY_NAME: Vehicle Valuation SaaS
GA4_DATA_STREAM_NAME: Web (vehicle-valuation.com)

# After creating property:
NEXT_PUBLIC_GA_MEASUREMENT_ID: G-XXXXXXXXXX
```

**Where to add**:
- Project `.env.local` file
- Vercel environment variables (production)

---

### 7. Sentry (Error Monitoring)

**Action**: Create account at https://sentry.io

**Required Information**:
```
SENTRY_ORG_SLUG: your-org-name
SENTRY_PROJECT_NAME: vehicle-valuation
SENTRY_ENVIRONMENT: production (or development)

# After creating project:
NEXT_PUBLIC_SENTRY_DSN: https://...@...sentry.io/...
SENTRY_AUTH_TOKEN: (create in Settings > Account > API > Auth Tokens)
```

**Where to add**:
- Project `.env.local` file
- `~/.claude.json` (for Sentry MCP)
- Vercel environment variables (production)

**MCP Setup** (after account creation):
Add to `~/.claude.json`:
```json
{
  "mcpServers": {
    "sentry": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-sentry"],
      "env": {
        "SENTRY_AUTH_TOKEN": "your-token-here",
        "SENTRY_ORG": "your-org-slug",
        "SENTRY_PROJECT": "vehicle-valuation"
      }
    }
  }
}
```

---

## Phase 3: External API Providers

### 8. VinAudit API

**Action**: Create account at https://www.vinaudit.com/api

**Required Information**:
```
VINAUDIT_API_KEY: (get from API dashboard)
VINAUDIT_PLAN: (start with pay-as-you-go, ~$0.02/call)
```

**Where to add**:
- Project `.env.local` file
- Vercel environment variables (production)

**Cost**: ~$0.02 per VIN decode

---

### 9. Auto.dev Listings API

**Action**: Create account at https://auto.dev

**Required Information**:
```
AUTODEV_API_KEY: (get from dashboard)
AUTODEV_PLAN: Free tier (1000 calls/month)
```

**Where to add**:
- Project `.env.local` file
- Vercel environment variables (production)

**Cost**: Free for first 1000 calls/month, then $0.002/call

---

### 10. CarsXE API

**Action**: Create account at https://api.carsxe.com

**Required Information**:
```
CARSXE_API_KEY: (get from dashboard)
CARSXE_PLAN: Freemium tier
```

**Where to add**:
- Project `.env.local` file
- Vercel environment variables (production)

**Cost**: Freemium (check current limits)

---

## MCP Configuration (for Claude Code)

### Existing MCPs (Already Configured)

According to your `~/.claude/CLAUDE.md`, these are already set up:

✅ **Context7** - No additional setup needed
✅ **Semgrep** - No additional setup needed
✅ **Exa** - Needs API key (optional)
✅ **Playwright** - No additional setup needed
✅ **ESLint** - No additional setup needed

### MCPs That Need Configuration

#### Supabase MCP
Add to `~/.claude/settings.json`:
```json
{
  "env": {
    "SUPABASE_URL": "https://[your-project].supabase.co",
    "SUPABASE_ANON_KEY": "your-anon-key-here"
  }
}
```

#### Linear MCP
- Already configured for OAuth
- Run `/mcp` → Select Linear → Complete OAuth

#### GitHub MCP
- Already configured for OAuth
- Run `/mcp` → Select GitHub → Complete OAuth

#### Sentry MCP (New - needs to be added)
Add to `~/.claude.json`:
```json
{
  "mcpServers": {
    "sentry": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-sentry"],
      "env": {
        "SENTRY_AUTH_TOKEN": "your-token",
        "SENTRY_ORG": "your-org-slug",
        "SENTRY_PROJECT": "vehicle-valuation"
      }
    }
  }
}
```

---

## Project Information

### Domain & Branding

```
DOMAIN_NAME: (to be decided, e.g., vehiclevaluation.app)
PROJECT_NAME: Vehicle Valuation SaaS
COMPANY_NAME: (your company name)
SUPPORT_EMAIL: support@your-domain.com
```

---

## .env.local Template

Create this file in project root (DO NOT commit to Git):

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://[project-id].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PRICE_ID_29=price_...
STRIPE_PRICE_ID_49=price_...
STRIPE_WEBHOOK_SECRET=whsec_...

# External APIs
VINAUDIT_API_KEY=your-key
AUTODEV_API_KEY=your-key
CARSXE_API_KEY=your-key

# Google Analytics
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX

# Sentry
NEXT_PUBLIC_SENTRY_DSN=https://...@...sentry.io/...
SENTRY_AUTH_TOKEN=your-token
SENTRY_ORG=your-org-slug
SENTRY_PROJECT=vehicle-valuation

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development
```

---

## .env.production Template

For Vercel production environment:

```env
# Same as .env.local but with production values:
# - Use Supabase production URL
# - Use Stripe live keys (pk_live_..., sk_live_...)
# - Use production Sentry DSN
# - Set NEXT_PUBLIC_APP_URL to your actual domain
# - Set NODE_ENV=production
```

---

## Setup Checklist

Copy this checklist and mark items as you complete them:

### Phase 1: Accounts
- [ ] Supabase account created
- [ ] Supabase project created
- [ ] Supabase credentials added to `.env.local`
- [ ] Supabase MCP configured in `~/.claude/settings.json`
- [ ] Stripe account created
- [ ] Stripe products created ($29 and $49)
- [ ] Stripe credentials added to `.env.local`
- [ ] Vercel account created
- [ ] GitHub account ready
- [ ] GitHub OAuth configured via `/mcp`
- [ ] Linear account created (optional)
- [ ] Linear OAuth configured via `/mcp` (optional)
- [ ] Google Analytics property created
- [ ] GA4 Measurement ID added to `.env.local`
- [ ] Sentry account created
- [ ] Sentry project created
- [ ] Sentry DSN added to `.env.local`
- [ ] Sentry MCP configured in `~/.claude.json`

### Phase 3: External APIs
- [ ] VinAudit API account created
- [ ] VinAudit API key added to `.env.local`
- [ ] Auto.dev API account created
- [ ] Auto.dev API key added to `.env.local`
- [ ] CarsXE API account created
- [ ] CarsXE API key added to `.env.local`

### Project Setup
- [ ] `.env.local` file created (not committed)
- [ ] `.env.example` file created (safe to commit)
- [ ] All environment variables configured
- [ ] MCP servers tested via `/mcp` command

---

## Quick Start Commands

Once you have all credentials:

```bash
# 1. Verify MCP configuration
# Run in Claude Code:
/mcp

# 2. Test Supabase connection
"Query Supabase to list all tables"

# 3. Test Linear integration
"Create Linear issue: Test issue for setup"

# 4. Test GitHub integration
"Show me my GitHub repositories"

# 5. Test Sentry integration (after adding to config)
"Show recent Sentry errors"
```

---

## Need Help?

If you're stuck on any setup step, ask:
- "How do I get my Supabase credentials?"
- "Walk me through creating a Stripe product"
- "How do I configure the Sentry MCP?"

---

## Security Notes

**NEVER commit these to Git**:
- `.env.local`
- `.env.production`
- Any file containing API keys, tokens, or secrets

**Always use** `.env.example` (with placeholder values) for reference.

**Add to `.gitignore`**:
```
.env*.local
.env.production
.env.staging
*.key
*.secret
```

---

**Last Updated**: December 9, 2024
**Status**: Ready for Phase 1 Setup
