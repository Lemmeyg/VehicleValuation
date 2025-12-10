# Claude Code MCP Usage Guidelines

This document outlines when and how to use Model Context Protocol (MCP) servers during development of the Vehicle Valuation SaaS MVP.

## Available MCPs

The following MCPs are configured globally and available for this project:

1. **Supabase MCP** - Database operations
2. **Linear MCP** - Issue tracking
3. **GitHub MCP** - Code management
4. **Sentry MCP** - Error monitoring
5. **Semgrep MCP** - Security scanning
6. **Exa MCP** - Developer search
7. **Context7 MCP** - API documentation
8. **ESLint MCP** - Code linting
9. **Playwright MCP** - UI testing

---

## Phase-by-Phase MCP Usage

### Phase 1: Project Setup ✅ COMPLETED

**Active MCPs**: None required

**Status**: Next.js 16 project initialized with all dependencies, testing infrastructure, code quality tools, and documentation.

---

### Phase 2: Database Setup & Auth

**Primary MCPs**:

- **Supabase MCP**: Create database schema, set up RLS policies, configure auth
- **Semgrep MCP**: Scan auth implementation for security vulnerabilities

**When to use**:

1. **Supabase MCP**:
   - Creating tables: `users`, `reports`, `payments`, `refund_requests`, `api_call_logs`
   - Setting up Row Level Security (RLS) policies
   - Creating database functions and triggers
   - Testing database queries

2. **Semgrep MCP**:
   - After implementing auth routes (`app/api/auth/*`)
   - Before committing auth-related code
   - Scan for: authentication bypasses, hardcoded secrets, insecure sessions

**Commands**:

```bash
# Supabase: Generate TypeScript types from database
npm run db:generate-types

# Semgrep: Scan auth code
npm run security:scan -- app/api/auth/
```

---

### Phase 3: Payment Integration

**Primary MCPs**:

- **Semgrep MCP**: Critical for payment security
- **Context7 MCP**: Stripe API documentation lookup

**When to use**:

1. **Semgrep MCP**:
   - After implementing Stripe payment routes
   - Before handling webhooks
   - Scan for: insecure payment handling, webhook verification issues

2. **Context7 MCP**:
   - Looking up Stripe API methods
   - Understanding webhook event types
   - Verifying best practices for payment handling

**Example prompts**:

- "Use Context7 to show me the correct way to verify Stripe webhook signatures"
- "Run Semgrep on app/api/payments/ and app/api/webhooks/stripe/"

---

### Phase 4: Vehicle Data API Integration

**Primary MCPs**:

- **Exa MCP**: Research API best practices
- **Context7 MCP**: API documentation for external services
- **Semgrep MCP**: Scan API client code

**When to use**:

1. **Exa MCP**:
   - "Search for best practices for handling external API rate limits"
   - "Find examples of robust API error handling in TypeScript"

2. **Context7 MCP**:
   - Looking up VinAudit API documentation
   - Understanding Auto.dev API response formats

3. **Semgrep MCP**:
   - After implementing API clients in `lib/api/`
   - Scan for: API key exposure, insecure HTTP requests

---

### Phase 5: Report Generation

**Primary MCPs**:

- **ESLint MCP**: Code quality for report logic
- **Semgrep MCP**: Security scan report generation
- **Context7 MCP**: @react-pdf/renderer documentation

**When to use**:

1. **ESLint MCP**:
   - Run on report generation components
   - Ensure code follows project style guide

2. **Semgrep MCP**:
   - Scan PDF generation code for XSS risks
   - Check file handling for path traversal vulnerabilities

3. **Context7 MCP**:
   - Look up @react-pdf/renderer API usage
   - Find examples of PDF styling

---

### Phase 6: Frontend Development

**Primary MCPs**:

- **ESLint MCP**: Continuous code quality checks
- **Playwright MCP**: E2E testing
- **Semgrep MCP**: Client-side security

**When to use**:

1. **ESLint MCP**:
   - Before committing React components
   - Run: `npm run lint`

2. **Playwright MCP**:
   - Testing critical user flows (login → create report → payment)
   - Accessibility testing: "Check accessibility of the vehicle input form"

3. **Semgrep MCP**:
   - Scan for: XSS vulnerabilities, insecure local storage usage

---

### Phase 7: Testing & QA

**Primary MCPs**:

- **Playwright MCP**: E2E testing
- **ESLint MCP**: Test code quality
- **Semgrep MCP**: Final security audit

**When to use**:

1. **Playwright MCP**:
   - Generate test code: "Create E2E test for complete report purchase flow"
   - Debug failing tests with screenshots

2. **ESLint MCP**:
   - Lint test files in `__tests__/` and `e2e/`

3. **Semgrep MCP**:
   - Full codebase security scan before deployment
   - Run: `npm run security:scan`

---

### Phase 8-10: Launch & Iteration

**Primary MCPs**:

- **Sentry MCP**: Monitor production errors
- **Linear MCP**: Track bugs and features
- **GitHub MCP**: Code reviews and PRs

**When to use**:

1. **Sentry MCP**:
   - "Check recent errors in production"
   - "Show me the most common error patterns"

2. **Linear MCP**:
   - "Create Linear issue: User reported payment failure on Safari"
   - "Show me all P0 bugs"

3. **GitHub MCP**:
   - "Create PR for feature/payment-retry-logic"
   - "Review PR #42 for security issues"

---

## General MCP Usage Patterns

### Security-First Development

**Every phase should include**:

```bash
# Before every commit
npm run lint
npm run type-check
npm run security:scan

# Automatically via Husky pre-commit hook
```

**Manual Semgrep usage**:

- **High-risk code**: Run Semgrep immediately after writing auth, payment, or API code
- **Before PRs**: Always scan changed files
- **Weekly**: Full codebase scan

---

### Code Quality Workflow

1. **Write code** → ESLint catches style issues
2. **Commit** → Husky runs lint-staged (ESLint + Prettier)
3. **Push** → GitHub Actions runs full CI (ESLint, TypeScript, Jest, Semgrep)
4. **PR Review** → Use GitHub MCP to review changes

---

### Database Development Workflow

1. **Design schema** → Document in PRD or Linear issue
2. **Create migration** → Use Supabase MCP or dashboard
3. **Apply migration** → Test locally first
4. **Generate types** → `npm run db:generate-types`
5. **Update TypeScript types** → Import into code

---

### Bug Tracking Workflow

1. **Error occurs** → Sentry MCP captures error
2. **Create issue** → Linear MCP creates bug ticket
3. **Fix locally** → ESLint + Semgrep validate fix
4. **Create PR** → GitHub MCP for code review
5. **Verify fix** → Playwright MCP E2E test

---

## Best Practices

### 1. Use MCPs Strategically

Don't use all MCPs for every task. Select 2-4 relevant MCPs per phase:

- **Database work**: Supabase + Semgrep
- **Payment work**: Semgrep + Context7
- **Frontend work**: ESLint + Playwright + Semgrep
- **Bug fixing**: Sentry + Linear + GitHub

### 2. Security Scanning Frequency

**Critical code (auth, payments)**:

- Scan immediately after implementation
- Scan before every commit touching these areas

**Standard code**:

- Scan before PRs
- Full scan weekly

### 3. Documentation Lookup Efficiency

**Use Context7 for**:

- React, Next.js, TypeScript fundamentals
- Stripe, Supabase API lookups
- Library usage (@react-pdf/renderer, Zod)

**Use Exa for**:

- Best practices research
- Architecture patterns
- Problem-solving when stuck

### 4. Testing Strategy

**Playwright MCP usage**:

- After completing each major feature
- Critical paths: auth flow, report creation, payment flow
- Before production deployment

**ESLint MCP usage**:

- Continuously during development (via IDE integration)
- Pre-commit via Husky
- CI/CD pipeline

---

## MCP Configuration Status

### ✅ Configured & Ready

- Context7 (no setup needed)
- ESLint (installed)
- Playwright (installed)
- Semgrep (available via CI/CD)

### ⚙️ Requires Setup

- **Supabase MCP**: Needs project credentials in settings.json
- **Linear MCP**: OAuth authentication required
- **GitHub MCP**: OAuth authentication required
- **Sentry MCP**: Needs auth token and project config
- **Exa MCP**: Needs API key in settings.json

### Setup Instructions

See [INPUTS.md](../../INPUTS.md) for detailed setup instructions for each MCP.

---

## Troubleshooting

### MCP Not Working

1. **Check configuration**: Verify MCP is listed in `~/.claude.json`
2. **Check authentication**: Run `/mcp` to see auth status
3. **Restart VS Code**: Sometimes required after config changes

### Semgrep False Positives

If Semgrep reports false positives:

```typescript
// nosemgrep: rule-id
const safeCode = potentiallyFlaggedCode()
```

Only use `nosemgrep` comments when you're certain the code is safe.

### Supabase MCP Connection Issues

1. Verify `SUPABASE_URL` and `SUPABASE_ANON_KEY` in settings.json
2. Check network connectivity
3. Ensure Supabase project is running

---

## Quick Reference

### Most Used Commands

```bash
# Linting & Formatting
npm run lint
npm run format

# Type Checking
npm run type-check

# Security Scanning
npm run security:scan

# Testing
npm run test
npm run test:e2e

# Database
npm run db:generate-types
```

### MCP Quick Actions

```
# Semgrep
Run Semgrep on app/api/auth/ for security vulnerabilities

# Context7
Use Context7 to look up Stripe webhook verification

# Exa
Search Exa for React Server Components best practices

# Linear
Create Linear issue: Fix payment webhook retry logic

# GitHub
Review PR #42 for security and quality issues
```

---

**Last Updated**: December 2025
**Project Phase**: Phase 1 Complete
