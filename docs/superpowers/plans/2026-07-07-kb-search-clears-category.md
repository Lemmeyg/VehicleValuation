# KB Search Clears Category Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clicking the Search button on the Knowledge Base page clears any active category filter, so search always runs against the full article set.

**Architecture:** Single-file client-state change in `components/KBClientPage.tsx` — no new components, no data/API changes.

**Tech Stack:** Next.js App Router client component, React hooks (`useState`, `useCallback`), Jest + `@testing-library/react`.

## Global Constraints

- Category-pill click behavior (`handleCategoryChange`) must remain unchanged — it still combines with an active search query.
- Design spec: `docs/superpowers/specs/2026-07-07-kb-search-clears-category-design.md`

---

### Task 1: Clear category filter on search submit

**Files:**

- Modify: `components/KBClientPage.tsx:52-58`
- Test: `__tests__/components/KBClientPage.test.tsx` (add a case to the existing file)

**Interfaces:**

- Consumes: existing `setActiveCategory`, `updateUrl` from the same component (no signature changes)
- Produces: n/a (leaf change, no other tasks depend on it)

- [ ] **Step 1: Write the failing test**

Add this test to `__tests__/components/KBClientPage.test.tsx` (inside the existing `describe('KBClientPage', ...)` block, after the other filter tests):

```tsx
it('clears an active category filter when a search is submitted', () => {
  render(<KBClientPage articles={articles} categories={categories} totalCount={3} />)

  // Select "State Guides" category — narrows to article-b only.
  fireEvent.click(screen.getByRole('button', { name: 'State Guides' }))
  expect(screen.queryByText('Valuation Tips')).not.toBeInTheDocument()

  // Search for a term that only matches an article in a DIFFERENT category.
  fireEvent.change(screen.getByPlaceholderText('Search articles…'), {
    target: { value: 'valuation' },
  })
  fireEvent.submit(screen.getByRole('button', { name: 'Search' }).closest('form')!)

  // The stale category filter should no longer suppress it.
  expect(screen.getByText('Valuation Tips')).toBeInTheDocument()
  expect(screen.queryByText('State Law Guide')).not.toBeInTheDocument()

  // The "All" category pill should be active again.
  expect(screen.getByRole('button', { name: 'All' })).toHaveClass('bg-primary-600')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/components/KBClientPage.test.tsx`
Expected: FAIL — `Valuation Tips` is not found because the stale `activeCategory: 'State Guides'` still filters it out.

- [ ] **Step 3: Implement the fix**

In `components/KBClientPage.tsx`, change lines 52-58 from:

```tsx
const handleSearch = useCallback(
  (query: string) => {
    setActiveQuery(query)
    updateUrl(query, activeCategory)
  },
  [activeCategory, updateUrl]
)
```

to:

```tsx
const handleSearch = useCallback(
  (query: string) => {
    setActiveQuery(query)
    setActiveCategory('')
    updateUrl(query, '')
  },
  [updateUrl]
)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/components/KBClientPage.test.tsx`
Expected: All tests in the file PASS, including the new one.

- [ ] **Step 5: Commit**

```bash
git add components/KBClientPage.tsx __tests__/components/KBClientPage.test.tsx
git commit -m "fix: clear category filter when KB search is submitted"
```

---

### Task 2: Regression check

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm run test:ci`
Expected: All tests pass.

- [ ] **Step 2: Manual smoke check**

Start the dev server (`npm run dev`), visit `/knowledge-base`:

1. Click a category pill — confirm articles narrow to that category.
2. Type a search term for an article in a _different_ category and click Search.
3. Confirm that article now appears and the "All" pill is active again (category pill deselected).

- [ ] **Step 3: Push branch and open PR**

Follow the standard workflow in the workspace `CLAUDE.md` (push branch, open PR, verify Vercel Preview before merging — do not merge to `main` without explicit confirmation).
