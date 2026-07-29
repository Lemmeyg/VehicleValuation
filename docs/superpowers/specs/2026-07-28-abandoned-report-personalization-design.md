# Abandoned Report Recovery — ZIP/State + Vehicle-Year Personalization Design

**Status:** Approved, ready for planning.

**Goal:** Make the Abandoned Report Recovery drip more relevant by linking each recipient to (a) their own state's total-loss-law KB article, resolved from the ZIP code they already submitted on the report form, and (b) a KB article matched to their vehicle's age (already decoded at submission). This builds directly on the 2026-07-13 vehicle-personalization work (`docs/superpowers/plans/2026-07-13-vehicle-personalization-abandoned-recovery.md`), which put `VehicleDescription` (e.g. "2019 Honda Civic") into the same 3-email drip via a Zoho custom field.

**Scope:** Abandoned Report Recovery only. Dispute Letter Nurture is explicitly out of scope — its signup form (`/dispute-letter`) collects only an email address (no ZIP, no VIN, no vehicle data), and its campaign doc already documents a deliberate 2026-07-12 decision to keep that campaign unpersonalized. Extending personalization there would require a new form field and reversing that decision — a separate future effort, not part of this spec.

**Confirmed as live:** the campaign owner confirmed Abandoned Report Recovery is live in Zoho (unlike the "not yet rebuilt" status still written in the campaign doc's header) — this work proceeds now rather than waiting.

---

## Architecture

Extend the existing cron (`app/api/cron/abandoned-report-recovery/route.ts`) rather than building a new system. It already:

- Selects each eligible `reports` row (`price_paid IS NULL`, old enough, not yet flagged)
- Reads `vehicle_year`/`vehicle_make`/`vehicle_model` and builds `VehicleDescription`
- Calls `addContactToList({ listKey, email, customFields })` to enroll into Zoho

This spec adds to that same per-report loop:

1. **Select `zip_code`** in addition to the columns already fetched (it's already on `reports`, populated at submission — no schema change needed).
2. **Resolve ZIP → 2-letter state code** via a small lookup library (see "ZIP lookup" below).
3. **Look up that state's KB article slug** from a static mapping table (see "State → article mapping" below).
4. **Bucket `vehicle_year`** into one of three age buckets and look up its KB article slug (see "Vehicle-year → article mapping" below).
5. **Build two new Zoho custom fields**, each a full URL with UTM tags matching the convention already used on the pricing-page CTA links (`utm_source=zoho&utm_medium=email&utm_content=...`):
   - `StateArticleURL` (+ `StateName` as plain text, for the sentence copy)
   - `VehicleGuideURL`
6. **Pass both through the existing `addContactToList` call**, alongside `VIN`/`VehicleDescription`.

**Alternative considered and rejected:** computing this at click-time via a redirect endpoint (e.g. `/api/personalize?email=...`). Rejected because it adds a new route, an email-in-URL lookup surface, and breaks the simple always-populated-merge-tag pattern the existing `VehicleDescription` field already established — for no benefit over doing the same lookup once at enrollment.

**Fallback behavior** (matches the existing `"your vehicle"` convention for `VehicleDescription`): every merge tag must always resolve to something, never blank or a broken tag.

- ZIP doesn't map to one of the 50 covered states (missing ZIP, DC, territory, bad data) → `StateArticleURL` falls back to the pillar article (`vehicle-owners-guide-to-total-loss`), `StateName` falls back to `"your state"`.
- `vehicle_year` is null (decode failed or predates this feature) → `VehicleGuideURL` falls back to the same pillar article.

---

## Content mappings

### State → article

Mechanical 1:1 mapping — all 50 states already have a "total loss law" KB article (confirmed live via direct query of the `articles` table, 2026-07-28). One naming wrinkle: Rhode Island has two articles (`rhode-island-total-loss-law-explained`, the general explainer, and `rhode-island-total-loss-law-2025-update`, a specific news piece about a threshold change) — use the general explainer. No other state has a conflict. The mapping table is a static config (JSON or TS object), not derived by guessing a slug pattern — the site's actual slugs aren't fully consistent (e.g. `florida-total-loss-state-law-explained`, `maryland-total-loss-state-rules-explained` deviate from the `{state}-total-loss-law-explained` pattern most others follow).

### Vehicle-year → article (approved 2026-07-28)

| Bucket  | Condition                                             | Article                                                   |
| ------- | ----------------------------------------------------- | --------------------------------------------------------- |
| Newer   | `vehicle_year >= current_year - 2`                    | `financed-vehicle-total-loss-loan-payoff-negative-equity` |
| Mid-age | `current_year - 9 <= vehicle_year < current_year - 2` | `total-loss-or-repair-how-to-decide`                      |
| Older   | `vehicle_year < current_year - 9`                     | `should-you-buy-back-your-totaled-car-hidden-costs`       |
| Missing | `vehicle_year IS NULL`                                | pillar fallback (`vehicle-owners-guide-to-total-loss`)    |

Rationale: newer vehicles are more likely to still carry a loan (negative-equity risk is the sharpest pain point); older vehicles are more likely paid off, where a low ACV offer makes buy-back a live question; mid-age vehicles get the more general repair-vs-total-loss decision article.

### ZIP → state lookup

Use a small, maintained npm package with a real ZIP→state dataset (server-only — this code runs inside a cron API route, never shipped to the client bundle, so dependency weight is a non-issue). Rejected a hand-built ZIP3-prefix range table: transcribing/maintaining ~1,000 rows by hand is exactly the kind of error a maintained package avoids, and a wrong state-law link actively damages trust rather than just being a missed opportunity. Confirm the specific package's current maintenance status at implementation time rather than pinning one here.

---

## Email copy placement

Deferred to the implementation/planning step rather than fixed here — placement (which of the 3 emails gets the state-law sentence vs. the vehicle-year sentence, or both) will be decided once the actual sentence-level copy is drafted, so the copy can be judged in context rather than slotted into a placement decided in the abstract. Constraints carried over from the existing campaign doc conventions (`docs/email-campaigns/abandoned-report-recovery.md`):

- Same brand voice — "we/Total Loss Toolkit", never a personal name, signs off "— Total Loss Toolkit"
- Same UTM convention as the existing `Finish My Report` CTAs
- Should read as one added sentence/clause per email, not a new visual block or restructured email
- Email 3 (the discount/urgency close) should be given the strongest consideration for staying link-free, so the new content doesn't dilute the final CTA — but not fixed as a hard rule; revisit once copy is drafted

---

## Out of scope

- Dispute Letter Nurture personalization (needs new ZIP capture on `/dispute-letter` first; a separate future effort)
- Backfilling `StateArticleURL`/`VehicleGuideURL` for reports that predate this feature (same non-goal precedent as the original vehicle-personalization plan, which didn't backfill `vehicle_year`/`make`/`model` either — fallback strings cover these rows)
- Any change to the two existing rollout blockers noted in the campaign doc (Zoho dashboard rebuild status text, `COMEBACK5` discount code) — those are tracked separately and this work does not depend on them, per the live-campaign confirmation above
