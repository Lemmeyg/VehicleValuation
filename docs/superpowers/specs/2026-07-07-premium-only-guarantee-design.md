# Design: Money-Back Guarantee — Premium Tier Only

**Date:** 2026-07-07
**Backlog ref:** High-12

## Context

The 100% Money-Back Guarantee card currently renders unconditionally on two surfaces, regardless of which price tier the buyer purchased:

1. **Payment success page** — `app/reports/[id]/success/page.tsx:257-266` (shown to authenticated buyers right after checkout)
2. **PDF report template** — `lib/pdf/report-template.tsx:1287-1295` (the downloadable/generated report)

The guarantee should only be offered to buyers who paid the Premium price point ($49 / `price_paid === 4900`), not Basic ($29 / `price_paid === 2900`).

## Approach

Reuse the existing tier-detection pattern already established in the codebase — no new logic:

```ts
const planType = report.price_paid === 2900 ? 'basic' : 'premium'
```

This exact ternary is already used in `app/reports/[id]/success/page.tsx:67` and `app/admin/reports/[id]/page.tsx:113`. The PDF template already receives a typed `reportType: 'BASIC' | 'PREMIUM'` prop (`lib/pdf/report-template.tsx:860`).

## Changes

### 1. `app/reports/[id]/success/page.tsx`

Wrap the guarantee `<div>` (currently lines 257-266) in a condition using the `planType` variable already computed at line 67:

```tsx
{
  planType === 'premium' && <div className="bg-green-50 rounded-lg p-6 mb-6">...</div>
}
```

### 2. `lib/pdf/report-template.tsx`

Wrap the `guaranteeBox` `<View>` (currently lines 1288-1295) in a condition on the existing `reportType` prop:

```tsx
{
  data.reportType === 'PREMIUM' && <View style={styles.guaranteeBox}>...</View>
}
```

## Out of scope

- **`app/reports/[id]/success/ReportReadyPoller.tsx`** (anonymous-buyer path) — does not currently render a guarantee card, so no change needed.
- **`app/reports/[id]/payment-buttons.tsx`** — mentions the guarantee as marketing copy while selling the Premium tier (advertising the benefit pre-purchase). This is not "the report" and stays as-is.

## Testing

- `__tests__/app/guarantee.test.tsx` — verify existing coverage; add/update assertions that a Basic-tier success page does NOT render the guarantee card and a Premium-tier one does.
- PDF template tests — add/update assertions that `reportType: 'BASIC'` omits the guarantee box and `reportType: 'PREMIUM'` includes it.
- Manual check: view a Basic report success page and a Premium report success page side by side; generate one PDF of each tier.

## Risks

None — this is a pure conditional-render change on data (`price_paid`, `reportType`) that already exists on both surfaces. No schema, API, or webhook changes required.
