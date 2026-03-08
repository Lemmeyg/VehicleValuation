# CRIT-02 Homepage Metadata Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add `metadataBase`, fix title/description, and add Open Graph tags to `app/layout.tsx`.

**Architecture:** Single file change — update the `metadata` export in `app/layout.tsx`.

**Tech Stack:** Next.js 16 Metadata API

---

### Task 1: Update metadata in app/layout.tsx

**Files:**

- Modify: `app/layout.tsx:20-24`

**Step 1: Replace the metadata export**

Find the existing `metadata` export (lines 20–24):

```ts
export const metadata: Metadata = {
  title: 'TotalLossToolKit.com - Independent Market Valuations',
  description:
    'Get independent, data-backed vehicle valuations. Professional reports for total loss claims, diminished value, and insurance negotiations.',
}
```

Replace with:

```ts
export const metadata: Metadata = {
  metadataBase: new URL('https://www.totallosstoolkit.com'),
  title: 'Total Loss Toolkit — Independent Vehicle Valuation Reports',
  description:
    'Get independent, data-backed vehicle valuations for total loss claims. Professional reports with real market comparables to help you negotiate a fair insurance settlement.',
  openGraph: {
    title: 'Total Loss Toolkit — Independent Vehicle Valuation Reports',
    description:
      'Get independent, data-backed vehicle valuations for total loss claims. Professional reports with real market comparables to help you negotiate a fair insurance settlement.',
    images: ['/opengraph-image'],
    url: 'https://www.totallosstoolkit.com',
    type: 'website',
  },
}
```

**Step 2: Run type-check**

```bash
cd "../Vehicle Comparison Site" && npm run type-check 2>&1 | tail -5
```

Expected: no errors

**Step 3: Run build and confirm no metadataBase warning**

```bash
npm run build 2>&1 | grep -i "metadataBase\|metadata"
```

Expected: the `metadataBase property in metadata export is not set` warning should be gone.

**Step 4: Verify tags in browser**

```bash
npm run dev
```

Open `http://localhost:3000` → View Source → confirm:

- `<title>Total Loss Toolkit — Independent Vehicle Valuation Reports</title>`
- `<meta name="description" content="Get independent...` (158 chars)
- `<meta property="og:title" ...>`
- `<meta property="og:description" ...>`
- `<meta property="og:image" ...>`

**Step 5: Commit**

```bash
git add app/layout.tsx
git commit -m "feat: CRIT-02 add metadataBase, OG tags, fix title and description"
```

---

### Task 2: Push branch and open PR

**Step 1: Push branch**

```bash
git push -u origin feat/crit-02-homepage-metadata
```

**Step 2: Open PR**

```bash
gh pr create \
  --title "feat: CRIT-02 homepage metadata — title, description, Open Graph" \
  --body "$(cat <<'EOF'
## Summary
- Adds `metadataBase` (fixes build warning about OG image resolution)
- Updates `<title>` to include "total loss" and clear value prop
- Fixes `<meta description>` to 158 chars (was 138, below 140 target)
- Adds `openGraph` tags: title, description, image, url, type

## Test Plan
- [ ] Build passes with no metadataBase warning
- [ ] View source on homepage confirms all five tags present
- [ ] Social share preview tested (e.g. Twitter Card Validator or LinkedIn post inspector)
- [ ] Vercel Preview URL checked before merging

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
