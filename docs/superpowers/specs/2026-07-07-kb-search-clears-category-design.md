# Design: Clear Category Filter on KB Search

**Date:** 2026-07-07
**Backlog ref:** "remove any category filters when the search button is clicked on the KB page"

## Context

The Knowledge Base page (`app/knowledge-base/page.tsx` → `components/KBClientPage.tsx`) supports two independent filters: a category pill and a free-text search box, both rendered by `components/KBFilterBar.tsx`. Both filters are combined with AND logic in `KBClientPage.tsx:24-39` (`filteredArticles` useMemo).

Submitting the search form (`KBFilterBar.tsx:28-31`, `type="submit"` button labeled "Search") calls `onSearch(inputValue)`, which maps to `handleSearch` in `KBClientPage.tsx:52-58`. That handler only updates `activeQuery` — it leaves any previously selected `activeCategory` in place. Result: a user who selects a category pill, then searches for a term that belongs to a different category, gets zero or unexpectedly narrow results with no indication why.

## Approach

Clear `activeCategory` whenever the search form is submitted. Category-pill clicks (`handleCategoryChange`) are untouched — selecting a category while a search query is active still narrows within that query, which is expected and useful.

## Change

`components/KBClientPage.tsx:52-58`, from:

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

Note the `activeCategory` dependency drops out of the `useCallback` deps array since the handler no longer reads it.

## Out of scope

- Category-pill click behavior (`handleCategoryChange`, `KBClientPage.tsx:60-67`) is unchanged — it still combines with an existing search query.
- `KBFilterBar.tsx` itself needs no changes — it already re-syncs its input display from `activeQuery` via the existing `useEffect` (lines 23-26), so clearing `activeCategory` in the parent is sufficient; the category pill's "active" styling is driven by the `activeCategory` prop and will naturally reset to "All".

## Testing

- `__tests__/components/KBClientPage.test.tsx` — add a case: click a category pill, submit a search for an article in a _different_ category, assert that article now appears (proving the stale category filter no longer suppresses it).

## Risks

None — pure client-state change, no data/schema/API impact.
