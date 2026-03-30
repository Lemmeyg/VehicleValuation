---
title: Report PDF Cleanup
date: 2026-03-30
status: approved
---

# Report PDF Cleanup — Design Spec

## Overview

Two targeted changes to the generated PDF report:

1. Remove the franchise and independent dealer counts from the Market Distribution & Analysis section.
2. Use vehicle year, make, and model in the PDF filename instead of the VIN.

---

## Change 1 — Remove Franchise/Independent Counts

**File:** `lib/pdf/report-template.tsx`

Remove the two `<View style={styles.statItem}>` blocks for FRANCHISE and INDEPENDENT (lines 1034–1041). The stats row will display four items: TOTAL ANALYZED · AVG PRICE · LOWEST · HIGHEST.

No changes needed to `lib/utils/listing-filters.ts` — the `franchiseCount` and `independentCount` values can remain computed without issue.

---

## Change 2 — PDF Filename Uses Year/Make/Model

**File:** `lib/services/pdf-generator.tsx`

**Current logic:**

```ts
const sanitizedVin = reportData.vin.toUpperCase().replace(/[^A-Z0-9]/g, '')
const filename = `total-loss-report-${sanitizedVin}.pdf`
```

**New logic:**

```ts
const vinData = reportData.autodev_vin_data
const year = vinData?.vehicle?.year
const make = vinData?.make
const model = vinData?.model

let filenamePart: string
if (year && make && model) {
  const sanitized = `${year}-${make}-${model}`.replace(/[^A-Za-z0-9-]/g, '-').replace(/-+/g, '-')
  filenamePart = sanitized
} else {
  filenamePart = reportData.vin.toUpperCase().replace(/[^A-Z0-9]/g, '')
}
const filename = `total-loss-report-${filenamePart}.pdf`
```

**Example outputs:**

- `total-loss-report-2019-Honda-Civic.pdf`
- `total-loss-report-2021-Land-Rover-Range-Rover.pdf`
- `total-loss-report-1HGBH41JXMN109186.pdf` (fallback when VIN decode unavailable)

**Test file:** `__tests__/lib/services/pdf-generator.test.ts`

Update tests to cover:

- Year/make/model produces correct filename
- Spaces in make/model are replaced with hyphens
- Falls back to VIN when vehicle data is absent

---

## Out of Scope

- No changes to the browser report view (franchise/independent counts are PDF-only)
- No changes to Supabase storage path structure (`reports/{user_id}/{filename}`)
- No migration of existing stored PDFs
