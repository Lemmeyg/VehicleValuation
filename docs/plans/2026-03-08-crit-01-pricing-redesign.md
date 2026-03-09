# CRIT-01 Pricing Page Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign the pricing page JSX layout to maximise card click-through — cards become the hero of the page, stats and quotes support above them, mobile gets accordion cards.

**Architecture:** Single-file JSX change to `app/pricing/page.tsx`. All business logic (state, handlers, API calls) is untouched — only the render output changes. A single new state variable (`expandedCard`) is added for mobile accordion behaviour.

**Tech Stack:** Next.js 16 / React 19, Tailwind CSS, existing Lucide icons (Check, CheckCircle2, Quote, ShieldCheck, ChevronDown already imported)

---

## What changes vs what stays

**Stays exactly the same (do not touch):**

- All imports (lines 1–20)
- `PRICING_TIERS` constant
- `Report` interface
- `PricingContent` function signature and all state variables (lines 84–105)
- All `useEffect`, `initializePricingPage`, `createAnonymousReport`, `fetchExistingReport`, `sendMagicLink`, `fetchMarketCheckData`, `handleSelectPlan` functions (lines 106–523)
- Loading state JSX (lines 525–547)
- Error state JSX (lines 549–564)
- Both modals: Beta Mode Modal and Existing User Modal (lines 780–1010)
- `PricingPage` export wrapper (lines 1014–1026)

**Changes — the main return JSX only (lines 566–776):**
New section order:

1. Compact hero headline + subtext
2. 3-stat strip
3. Two social proof quotes
4. Pricing cards (desktop: both open; mobile: accordion)
5. Money-back guarantee banner (existing, keep as-is)
6. Report preview toggle (existing, keep as-is)

---

## Task 1: Add mobile accordion state variable

**Files:**

- Modify: `app/pricing/page.tsx` — add one line after line 100

**Step 1: Add state after `setMagicLinkError` on line 101**

Find this block (around line 96–101):

```tsx
const [showReportPreview, setShowReportPreview] = useState(false)
const [sendingMagicLink, setSendingMagicLink] = useState(false)
const [magicLinkSent, setMagicLinkSent] = useState(false)
const [magicLinkError, setMagicLinkError] = useState('')
```

Add one line after `setMagicLinkError`:

```tsx
const [expandedCard, setExpandedCard] = useState<string | null>(null)
```

**Step 2: Run type-check**

```bash
cd "../Vehicle Comparison Site" && npm run type-check 2>&1 | grep "pricing" | head -5
```

Expected: no errors for pricing page

**Step 3: Commit**

```bash
git add app/pricing/page.tsx
git commit -m "feat: CRIT-01 add expandedCard state for mobile accordion"
```

---

## Task 2: Replace the main JSX return body

**Files:**

- Modify: `app/pricing/page.tsx` — replace lines 566–776 (the `return (` block inside `PricingContent`, up to but not including the modals)

**Step 1: Find the exact block to replace**

The block starts at:

```tsx
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="pt-24 pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Why Independent Valuation? Section */}
```

And ends just before:

```tsx
{
  /* Beta Mode Modal - For Anonymous Users */
}
```

**Step 2: Replace that entire block with the following**

```tsx
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="pt-24 pb-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* Hero Headline */}
          <div className="text-center mb-6">
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">
              Get Paid What Your Vehicle Is Worth
            </h1>
            <p className="text-slate-600 text-base max-w-xl mx-auto">
              Insurance adjusters use professional market data. Now you can too — before you settle.
            </p>
          </div>

          {/* Stat Strip */}
          <div className="grid grid-cols-3 gap-3 mb-8 max-w-2xl mx-auto">
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-3 text-center">
              <p className="text-2xl font-bold text-primary-600">9/10</p>
              <p className="text-xs text-slate-500 leading-tight mt-0.5">Claims undervalued by insurers</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-3 text-center">
              <p className="text-2xl font-bold text-primary-600">34%</p>
              <p className="text-xs text-slate-500 leading-tight mt-0.5">Average settlement increase</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-3 text-center">
              <p className="text-2xl font-bold text-primary-600">90</p>
              <p className="text-xs text-slate-500 leading-tight mt-0.5">Days to dispute your offer</p>
            </div>
          </div>

          {/* Social Proof Quotes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            <blockquote className="bg-white border-l-4 border-primary-500 pl-5 py-4 pr-5 rounded-r-xl shadow-sm">
              <div className="flex items-start gap-3">
                <Quote className="h-5 w-5 text-primary-400 flex-shrink-0 mt-0.5" />
                <p className="text-slate-700 italic text-sm leading-relaxed">
                  &ldquo;First offer was $23.5K... sent an updated list of comps and ended up
                  receiving <strong className="text-primary-600 not-italic">$28K</strong>.&rdquo;
                </p>
              </div>
            </blockquote>
            <blockquote className="bg-white border-l-4 border-primary-500 pl-5 py-4 pr-5 rounded-r-xl shadow-sm">
              <div className="flex items-start gap-3">
                <Quote className="h-5 w-5 text-primary-400 flex-shrink-0 mt-0.5" />
                <p className="text-slate-700 italic text-sm leading-relaxed">
                  &ldquo;They initially tried to offer $9,800... The independent vehicle evaluator
                  pegged it at <strong className="text-primary-600 not-italic">$23,000</strong>.
                  They cut me a check a week later.&rdquo;
                </p>
              </div>
            </blockquote>
          </div>

          {/* Pricing Cards */}
          <div className="mb-8">
            <div className="text-center mb-6">
              <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-1">
                Choose Your Report
              </h2>
              <p className="text-sm text-slate-500">
                One-time payment · Instant access · 100% satisfaction guarantee
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Already have an account?{' '}
                <a href="/auth" className="text-primary-600 hover:underline">
                  Sign in
                </a>
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {PRICING_TIERS.map(tier => {
                const isExpanded = expandedCard === tier.id
                return (
                  <div
                    key={tier.id}
                    className={`relative bg-white rounded-2xl shadow-lg border-2 transition-all ${
                      tier.recommended
                        ? 'border-primary-500'
                        : 'border-slate-200 hover:border-primary-300'
                    }`}
                  >
                    {tier.recommended && (
                      <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                        <span className="bg-gradient-to-r from-primary-600 to-emerald-600 text-white px-4 py-1 rounded-full text-sm font-semibold shadow-lg inline-block whitespace-nowrap">
                          Recommended
                        </span>
                      </div>
                    )}

                    {/* Card header — always visible */}
                    <div className="p-6 pb-4">
                      <div className="flex items-center justify-between md:justify-center md:flex-col md:text-center">
                        <div className="md:mb-3">
                          <h3 className="text-xl font-bold text-slate-900">{tier.name}</h3>
                          <div className="flex items-baseline gap-1 mt-1 md:justify-center">
                            <span className="text-4xl font-bold text-slate-900">${tier.price}</span>
                            <span className="text-slate-400 text-sm">one-time</span>
                          </div>
                        </div>

                        {/* Mobile expand toggle */}
                        <button
                          className="md:hidden flex items-center gap-1 text-sm text-primary-600 font-medium"
                          onClick={() => setExpandedCard(isExpanded ? null : tier.id)}
                        >
                          {isExpanded ? 'Hide' : 'See'} details
                          <ChevronDown
                            className={`h-4 w-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                          />
                        </button>
                      </div>

                      {/* CTA button — always visible */}
                      <Button
                        onClick={() => handleSelectPlan(tier)}
                        disabled={processingPayment}
                        className={`w-full mt-4 py-5 text-base font-semibold ${
                          tier.recommended
                            ? 'bg-gradient-to-r from-primary-600 to-emerald-600 hover:from-primary-700 hover:to-emerald-700'
                            : 'bg-slate-900 hover:bg-slate-800'
                        }`}
                      >
                        {processingPayment ? 'Processing...' : `Get ${tier.name} — $${tier.price}`}
                      </Button>
                    </div>

                    {/* Feature list — always visible on desktop, accordion on mobile */}
                    <div className={`px-6 pb-6 ${isExpanded ? 'block' : 'hidden'} md:block`}>
                      <ul className="space-y-2.5 pt-3 border-t border-slate-100">
                        {tier.features.map((feature, index) => (
                          <li key={index} className="flex items-start">
                            <Check className="h-4 w-4 text-emerald-500 mr-2.5 flex-shrink-0 mt-0.5" />
                            <span className="text-slate-600 text-sm">{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Money-Back Guarantee Banner */}
          <div className="mb-8">
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="flex-shrink-0">
                <ShieldCheck className="h-10 w-10 text-emerald-600" />
              </div>
              <div className="flex-grow">
                <h3 className="font-bold text-slate-900 text-base mb-1">
                  Premium Report — Money-Back Guarantee
                </h3>
                <p className="text-sm text-slate-600">
                  If our Premium Report doesn&apos;t help increase your settlement by more than $25,
                  we&apos;ll refund you. No questions asked.
                </p>
              </div>
              <a
                href="/guarantee"
                className="flex-shrink-0 text-sm font-semibold text-emerald-700 hover:text-emerald-900 underline underline-offset-2 transition-colors"
              >
                Full terms →
              </a>
            </div>
          </div>

          {/* Report Preview Toggle */}
          <div className="mb-8">
            <button
              onClick={() => {
                const next = !showReportPreview
                setShowReportPreview(next)
                if (next) {
                  trackEvent('report_preview_viewed', { reportId: report?.id })
                }
              }}
              className="w-full flex items-center justify-between px-6 py-4 bg-white border border-slate-200 rounded-2xl shadow-sm hover:border-primary-300 hover:shadow-md transition-all group"
            >
              <span className="font-semibold text-slate-800 group-hover:text-primary-700 transition-colors">
                See what&apos;s inside your report
              </span>
              <ChevronDown
                className={`h-5 w-5 text-slate-500 transition-transform duration-200 ${
                  showReportPreview ? 'rotate-180' : ''
                }`}
              />
            </button>

            {showReportPreview && (
              <div className="mt-4 border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <ReportPreviewCondensed />
              </div>
            )}
          </div>

        </div>
      </main>

      <Footer />
```

**Step 3: Run type-check**

```bash
npm run type-check 2>&1 | grep "pricing" | head -10
```

Expected: no errors

**Step 4: Verify visually in dev server**

```bash
npm run dev
```

Navigate to `http://localhost:3000/pricing?reportId=<any-report-id>` or trigger via homepage form.

Confirm:

- Desktop: both cards fully visible side by side, no accordion toggle shown
- Mobile (DevTools → responsive): cards show name/price/CTA only, "See details" button expands feature list
- Stat strip shows 3 stats in a row
- Quotes appear above cards
- Money-back banner and report preview toggle still work

**Step 5: Commit**

```bash
git add app/pricing/page.tsx
git commit -m "feat: CRIT-01 redesign pricing page — stat strip, quotes above cards, mobile accordion"
```

---

## Task 3: Push branch and open PR

**Step 1: Push branch**

```bash
git push -u origin feat/crit-01-pricing-redesign
```

**Step 2: Open PR**
Go to: `https://github.com/Lemmeyg/VehicleValuation/pull/new/feat/crit-01-pricing-redesign`

Title: `feat: CRIT-01 pricing page redesign for conversion`

Body:

```
## Summary
- Replaced large "Why Independent Valuation" block with compact 3-stat strip above cards
- Social proof quotes repositioned directly above pricing cards
- Cards are now the visual hero of the page
- Mobile: card features are accordion (collapsed by default, tap "See details" to expand)
- Desktop: both cards always fully expanded side by side
- Kept money-back guarantee banner and report preview toggle unchanged
- Zero changes to business logic, state handlers, or API calls

## Test Plan
- [ ] Desktop: both cards fully visible, no accordion toggle
- [ ] Mobile: "See details" toggle works, features expand/collapse
- [ ] Both pricing CTAs trigger handleSelectPlan correctly
- [ ] Money-back guarantee banner displays
- [ ] Report preview toggle opens/closes
- [ ] Vercel Preview URL checked before merging
```
