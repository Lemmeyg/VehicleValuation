# Design: KB Article List Metadata Query (Egress Reduction Fix #1 + #2)

**Date:** 2026-06-16
**Status:** Approved
**Goal:** Eliminate `content` (full article markdown body) from all list-view Supabase queries and cache the result, reducing Supabase uncached egress by ~95%+ on KB traffic.

---

## Background

The site exceeded the Supabase free-plan 5 GB uncached egress limit (5.83 GB used). The primary driver is `getAllArticles()` in `lib/knowledge-base-db.ts`, which fetches all article rows including the full `content` field on every KB index page load and every article page build. The KB index page (`/knowledge-base`) is dynamically rendered (reads `searchParams`) — every visitor triggers a fresh Supabase query pulling all article content.

Estimated egress: 50 articles × ~8 KB content = ~400 KB per request. At moderate traffic this exceeds the monthly quota on its own.

---

## Scope

**In scope:**

- New `ArticleListItem` type and `getArticleListMetadata()` function
- Function-level caching via `unstable_cache` (1-hour TTL)
- Fix `getArticlesByCategory()` column selection
- Update utility function signatures (`getRelatedArticles`, `deriveCategories`, `filterArticlesByCategory`)
- Update three call sites: KB index, article page, admin KB page
- Add `export const revalidate = 3600` to KB index page

**Out of scope:**

- Cache invalidation on publish (1-hour TTL accepted as sufficient)
- Fixes to admin pages (reports, users) — separate issue
- Changes to `getAllArticles()`, `getArticleBySlug()`, `getArticleBySlugStatic()` — untouched

---

## Type Design

Add `ArticleListItem` as a named export from `lib/knowledge-base-db.ts`:

```ts
export type ArticleListItem = Omit<Article, 'content' | 'htmlContent'>
```

This makes intent explicit and lets TypeScript catch accidental `content` access in list contexts. `RelatedArticlesSidebar` already accepts `Pick<Article, 'slug' | 'title' | 'category' | 'readingTime'>[]` — a strict subset of `ArticleListItem` — so no change needed there.

---

## New Function: `getArticleListMetadata()`

**Location:** `lib/knowledge-base-db.ts`

**Query columns** (explicit list, no `content` or `htmlContent`):

```
slug, title, description, category, tags, author,
date_published, date_modified, featured, published, reading_time
```

**Client:** Plain `supabase` anon client (not the cookie-based `createServerSupabaseClient`). The cookie-based client cannot be used inside `unstable_cache` because it reads request cookies. Public published articles are accessible with the anon key (same pattern as existing `getArticleMetaBySlug`).

**Caching:** Wrapped in `next/cache` `unstable_cache` with:

- Cache key: `['article-list-metadata']`
- Tags: `['article-list-metadata']` (enables future `revalidateTag` invalidation)
- `revalidate: 3600` (1-hour TTL)

**Filter:** Published-only (same as current `getAllArticles()` behaviour in production).

**Return type:** `Promise<ArticleListItem[]>`

---

## Fix: `getArticlesByCategory()`

Change `select('*')` to the same explicit column list as above (excluding `content`). Return type changes from `Article[]` to `ArticleListItem[]`. No caching added — parameterised queries are less impactful and caching per-category adds complexity.

---

## Utility Function Signature Updates

Three functions in two files need their input type updated from `Article[]` to `ArticleListItem[]`:

| File                            | Function                                               | Change                                                                     |
| ------------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------- |
| `lib/utils/related-articles.ts` | `getRelatedArticles(currentSlug, allArticles, limit?)` | `allArticles: Article[]` → `ArticleListItem[]`, return `ArticleListItem[]` |
| `lib/utils/kb-articles.ts`      | `deriveCategories(articles)`                           | `articles: Article[]` → `ArticleListItem[]`                                |
| `lib/utils/kb-articles.ts`      | `filterArticlesByCategory(articles, category)`         | `articles: Article[]` → `ArticleListItem[]`, return `ArticleListItem[]`    |

None of these functions access `content` — the type change is a declaration update only.

---

## Call Site Changes

| File                                 | Change                                                                                |
| ------------------------------------ | ------------------------------------------------------------------------------------- |
| `app/knowledge-base/page.tsx`        | `getAllArticles()` → `getArticleListMetadata()`; add `export const revalidate = 3600` |
| `app/knowledge-base/[slug]/page.tsx` | `getAllArticles()` → `getArticleListMetadata()`                                       |
| `app/admin/knowledge-base/page.tsx`  | `getAllArticles()` → `getArticleListMetadata()`                                       |

**Note on admin draft visibility:** `getAllArticles()` already filters to published-only in production (`NODE_ENV === 'production'`), so the admin "Drafts" count badge is already always 0 in production. `getArticleListMetadata()` matches this behaviour exactly — no regression.

---

## UX Impact

- **Visitors:** None. Article cards display title, description, category, tags, reading time — all in `ArticleListItem`.
- **Article detail pages:** None. Content fetched separately via `getArticleBySlugStatic()` (untouched).
- **Publisher:** New articles appear on KB index within 1 hour of being inserted into Supabase (cache TTL). Article URLs themselves are unaffected.
- **Performance:** Positive. KB index page loads faster (smaller Supabase response + cached).
- **SEO:** Positive. Faster pages improve Core Web Vitals. Bots receive full rendered HTML unchanged.

---

## What Is Not Changed

- `getAllArticles()` — preserved for any future full-content list use case
- `getArticleBySlug()` / `getArticleBySlugStatic()` — full content fetches for detail views
- `searchArticles()` — already returns `content: ''`, no change needed
- Database schema, RLS policies, Vercel config
- Any component rendering logic

---

## Verification Plan

1. TypeScript build passes: `npm run type-check`
2. Dev server: KB index renders all articles with correct category filter and search
3. Article detail page: Related articles sidebar populates correctly
4. Admin KB page: Articles grouped by category, counts correct
5. No runtime errors in browser console
