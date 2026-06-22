# KB Article List Metadata Query Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `getAllArticles()` (which downloads full article `content` for every request) with a metadata-only query wrapped in a 1-hour server-side cache, eliminating ~95% of Supabase egress from KB traffic.

**Architecture:** Add `ArticleListItem = Omit<Article, 'content' | 'htmlContent'>` type and `getArticleListMetadata()` function to the existing `lib/knowledge-base-db.ts`. The new function uses the plain `supabase` anon client (already imported) wrapped in Next.js `unstable_cache` with a 1-hour TTL. Update three call sites and two utility function signatures to use the narrower type. `getAllArticles()` is left untouched.

**Tech Stack:** Next.js 15 App Router, TypeScript, Supabase JS v2, `next/cache` (`unstable_cache`)

**Spec:** `docs/superpowers/specs/2026-06-16-kb-egress-metadata-query-design.md`

---

## File Map

| Action | File                                 | What changes                                                                                                                                         |
| ------ | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Modify | `lib/knowledge-base-db.ts`           | Add `ArticleListItem` type, `ARTICLE_LIST_SELECT` constant, `getArticleListMetadata()` function; fix `getArticlesByCategory()` columns + return type |
| Modify | `lib/utils/related-articles.ts`      | Update import + `getRelatedArticles()` signature                                                                                                     |
| Modify | `lib/utils/kb-articles.ts`           | Update import + `deriveCategories()` + `filterArticlesByCategory()` signatures                                                                       |
| Modify | `app/knowledge-base/page.tsx`        | Swap `getAllArticles` → `getArticleListMetadata`; add `revalidate`                                                                                   |
| Modify | `app/knowledge-base/[slug]/page.tsx` | Swap `getAllArticles` → `getArticleListMetadata`                                                                                                     |
| Modify | `app/admin/knowledge-base/page.tsx`  | Swap `getAllArticles` → `getArticleListMetadata`                                                                                                     |

---

## Task 1: Create feature branch and baseline

**Files:** none

- [ ] **Step 1: Verify you are on main and it is clean**

```bash
cd "C:\Users\Gordo\Documents\Vehicle Comparison Site"
git status
git log --oneline -3
```

Expected: on branch `main`, nothing to commit, top commit is the spec doc.

- [ ] **Step 2: Create feature branch**

```bash
git checkout -b fix/kb-article-list-metadata
```

Expected: `Switched to a new branch 'fix/kb-article-list-metadata'`

- [ ] **Step 3: Confirm type-check passes before any changes**

```bash
npm run type-check
```

Expected: exits with no errors (0 type errors). This is your baseline.

---

## Task 2: Add `ArticleListItem` type, column constant, and `getArticleListMetadata()` to `lib/knowledge-base-db.ts`

**Files:**

- Modify: `lib/knowledge-base-db.ts`

The file currently starts with:

```ts
import { createServerSupabaseClient, supabase } from './db/supabase'
import { markdownToHtml } from './markdown'

export interface Article { ... }
```

- [ ] **Step 1: Add `unstable_cache` import**

At the top of `lib/knowledge-base-db.ts`, add one import after the existing imports (lines 1-2):

```ts
import { createServerSupabaseClient, supabase } from './db/supabase'
import { markdownToHtml } from './markdown'
import { unstable_cache } from 'next/cache'
```

- [ ] **Step 2: Add `ArticleListItem` type and column constant after the `Article` interface**

The `Article` interface ends around line 25 (closes with `}`). Insert this block immediately after it:

```ts
export type ArticleListItem = Omit<Article, 'content' | 'htmlContent'>

const ARTICLE_LIST_SELECT =
  'slug, title, description, category, tags, author, date_published, date_modified, featured, published, reading_time'
```

- [ ] **Step 3: Add `getArticleListMetadata()` function after the constant**

Insert this function block immediately after the `ARTICLE_LIST_SELECT` constant, before the `getAllArticles()` function:

```ts
export const getArticleListMetadata = unstable_cache(
  async (): Promise<ArticleListItem[]> => {
    const { data: articles, error } = await supabase
      .from('articles')
      .select(ARTICLE_LIST_SELECT)
      .eq('published', true)
      .order('date_published', { ascending: false })

    if (error || !articles) {
      console.error('Error fetching article list metadata:', error)
      return []
    }

    return articles.map(article => ({
      slug: article.slug,
      title: article.title,
      description: article.description,
      category: article.category,
      tags: article.tags || [],
      author: article.author,
      datePublished: article.date_published,
      dateModified: article.date_modified,
      featured: article.featured || false,
      published: article.published !== false,
      readingTime: article.reading_time || '5 min read',
    }))
  },
  ['article-list-metadata'],
  { revalidate: 3600, tags: ['article-list-metadata'] }
)
```

- [ ] **Step 4: Verify type-check still passes (additive change — no errors expected)**

```bash
npm run type-check
```

Expected: 0 errors. If there are errors, they will be in the new code you just added — fix before continuing.

---

## Task 3: Fix `getArticlesByCategory()` column selection in `lib/knowledge-base-db.ts`

**Files:**

- Modify: `lib/knowledge-base-db.ts:172-201`

`getArticlesByCategory()` currently does `select('*')` and returns `Article[]`. We change it to use `ARTICLE_LIST_SELECT` and return `ArticleListItem[]`.

- [ ] **Step 1: Update the function signature and select call**

Find `getArticlesByCategory` (around line 172). Replace the entire function:

```ts
export async function getArticlesByCategory(category: string): Promise<ArticleListItem[]> {
  const supabase = await createServerSupabaseClient()

  const { data: articles, error } = await supabase
    .from('articles')
    .select(ARTICLE_LIST_SELECT)
    .eq('category', category)
    .eq('published', true)
    .order('date_published', { ascending: false })

  if (error || !articles) {
    console.error('Error fetching articles by category:', error)
    return []
  }

  return articles.map(article => ({
    slug: article.slug,
    title: article.title,
    description: article.description,
    category: article.category,
    tags: article.tags || [],
    author: article.author,
    datePublished: article.date_published,
    dateModified: article.date_modified,
    featured: article.featured || false,
    published: article.published !== false,
    readingTime: article.reading_time || '5 min read',
  }))
}
```

- [ ] **Step 2: Verify type-check passes**

```bash
npm run type-check
```

Expected: 0 errors. The return type change is backward-compatible with the KB index page because `ArticleListItem[]` is used there (it's assignable where `Article[]` was expected, since all rendering fields are present).

---

## Task 4: Update utility function signatures

**Files:**

- Modify: `lib/utils/related-articles.ts`
- Modify: `lib/utils/kb-articles.ts`

These functions only use `slug`, `category`, `tags`, `datePublished` — none access `content`. The signature update is a declaration-only change; function bodies are unchanged.

- [ ] **Step 1: Update `lib/utils/related-articles.ts`**

The file currently imports `Article`. Replace the entire file content:

```ts
import type { ArticleListItem } from '@/lib/knowledge-base-db'

export function getRelatedArticles(
  currentSlug: string,
  allArticles: ArticleListItem[],
  limit: number = 3
): ArticleListItem[] {
  const current = allArticles.find(a => a.slug === currentSlug)
  if (!current) return []

  const others = allArticles.filter(a => a.slug !== currentSlug)

  const scored = others.map(article => {
    let score = 0
    if (article.category === current.category) score += 6
    const sharedTags = article.tags.filter(tag => current.tags.includes(tag))
    score += sharedTags.length * 2
    return { article, score }
  })

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return new Date(b.article.datePublished).getTime() - new Date(a.article.datePublished).getTime()
  })

  const positive = scored
    .filter(s => s.score > 0)
    .slice(0, limit)
    .map(s => s.article)

  if (positive.length < limit) {
    const fallback = scored
      .filter(s => s.score <= 0)
      .slice(0, limit - positive.length)
      .map(s => s.article)
    return [...positive, ...fallback]
  }

  return positive
}
```

- [ ] **Step 2: Update `lib/utils/kb-articles.ts`**

Replace the entire file content:

```ts
import type { ArticleListItem } from '@/lib/knowledge-base-db'

export type CategoryCount = { name: string; count: number }

export function deriveCategories(articles: ArticleListItem[]): CategoryCount[] {
  const counts = new Map<string, number>()
  for (const article of articles) {
    counts.set(article.category, (counts.get(article.category) ?? 0) + 1)
  }
  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
}

export function filterArticlesByCategory(
  articles: ArticleListItem[],
  category: string
): ArticleListItem[] {
  return articles.filter(a => a.category === category)
}
```

- [ ] **Step 3: Run type-check — expect errors at call sites**

```bash
npm run type-check
```

Expected: errors in `app/knowledge-base/page.tsx` and `app/knowledge-base/[slug]/page.tsx` where `getAllArticles()` (returning `Article[]`) is passed to functions now expecting `ArticleListItem[]`. These are the call sites we fix in Tasks 5 and 6. **Do not fix them yet — confirm the errors are only in those files.**

---

## Task 5: Update KB index page

**Files:**

- Modify: `app/knowledge-base/page.tsx`

- [ ] **Step 1: Update the import line**

Find this import (line 11):

```ts
import { getAllArticles, searchArticles, getArticlesByCategory } from '@/lib/knowledge-base-db'
```

Replace with:

```ts
import {
  getArticleListMetadata,
  searchArticles,
  getArticlesByCategory,
} from '@/lib/knowledge-base-db'
```

- [ ] **Step 2: Add revalidate export**

Add this line immediately after the imports, before the `const siteUrl = ...` line:

```ts
export const revalidate = 3600
```

- [ ] **Step 3: Swap the function call**

Find (around line 49):

```ts
  const [allArticles, searchResults] = await Promise.all([
    getAllArticles(),
```

Replace with:

```ts
  const [allArticles, searchResults] = await Promise.all([
    getArticleListMetadata(),
```

- [ ] **Step 4: Run type-check — KB index errors should be gone**

```bash
npm run type-check
```

Expected: errors only in `app/knowledge-base/[slug]/page.tsx` now (the article page is still using `getAllArticles`).

---

## Task 6: Update article detail page

**Files:**

- Modify: `app/knowledge-base/[slug]/page.tsx`

- [ ] **Step 1: Update the import line**

Find line 1:

```ts
import { getArticleBySlugStatic, getAllArticles, getAllArticleSlugs } from '@/lib/knowledge-base-db'
```

Replace with:

```ts
import {
  getArticleBySlugStatic,
  getArticleListMetadata,
  getAllArticleSlugs,
} from '@/lib/knowledge-base-db'
```

- [ ] **Step 2: Swap the function call**

Find (around line 68):

```ts
const [article, allArticles] = await Promise.all([getArticleBySlugStatic(slug), getAllArticles()])
```

Replace with:

```ts
const [article, allArticles] = await Promise.all([
  getArticleBySlugStatic(slug),
  getArticleListMetadata(),
])
```

- [ ] **Step 3: Run type-check — all errors should be resolved**

```bash
npm run type-check
```

Expected: 0 errors. If there are remaining errors, they will name the file and line — fix them before continuing.

---

## Task 7: Update admin KB page

**Files:**

- Modify: `app/admin/knowledge-base/page.tsx`

- [ ] **Step 1: Update the import line**

Find line 7:

```ts
import { getAllArticles } from '@/lib/knowledge-base-db'
```

Replace with:

```ts
import { getArticleListMetadata } from '@/lib/knowledge-base-db'
```

- [ ] **Step 2: Swap the function call**

Find line 11:

```ts
const articles = await getAllArticles()
```

Replace with:

```ts
const articles = await getArticleListMetadata()
```

- [ ] **Step 3: Run type-check — must be clean**

```bash
npm run type-check
```

Expected: 0 errors. This is the final type-check gate before commit.

---

## Task 8: Verify on dev server

**Files:** none

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

Wait for `▲ Next.js ... ready` message. Keep running in terminal.

- [ ] **Step 2: Check KB index page**

Open `http://localhost:3000/knowledge-base` in browser.

Verify:

- All article cards render (title, description, category badge, tags, reading time)
- Category filter bar shows all categories with correct counts
- No console errors

- [ ] **Step 3: Check KB index with category filter**

Navigate to `http://localhost:3000/knowledge-base?category=Claims%20Strategy` (or any real category name you see on the page).

Verify:

- Filtered articles render correctly
- Count updates correctly

- [ ] **Step 4: Check KB index with search**

Navigate to `http://localhost:3000/knowledge-base?q=total+loss`

Verify:

- Search results render correctly
- No console errors

- [ ] **Step 5: Check an article detail page**

Open any article from the KB index. On the article page verify:

- Article content renders fully (this uses `getArticleBySlugStatic`, unchanged)
- Related articles sidebar shows 1–3 articles with correct titles
- Browse Topics sidebar shows categories with counts
- No console errors

- [ ] **Step 6: Check admin KB page**

Open `http://localhost:3000/admin/knowledge-base`

Verify:

- Articles grouped by category
- Total/Published/Drafts/Featured counts visible (Drafts will be 0 — expected, matches production behaviour)
- View and Edit links present per article
- No console errors

- [ ] **Step 7: Stop the dev server**

Press `Ctrl+C` in the terminal.

---

## Task 9: Commit and open PR

**Files:** all modified files

- [ ] **Step 1: Stage all changed files**

```bash
git add lib/knowledge-base-db.ts lib/utils/related-articles.ts lib/utils/kb-articles.ts app/knowledge-base/page.tsx "app/knowledge-base/[slug]/page.tsx" app/admin/knowledge-base/page.tsx
```

- [ ] **Step 2: Confirm staged files**

```bash
git diff --cached --stat
```

Expected output (6 files):

```
 app/admin/knowledge-base/page.tsx      |  2 +-
 app/knowledge-base/[slug]/page.tsx     |  2 +-
 app/knowledge-base/page.tsx            |  3 +-
 lib/knowledge-base-db.ts              | 38 ++++++++++++++++++++++++++
 lib/utils/kb-articles.ts              |  6 ++--
 lib/utils/related-articles.ts         |  4 +--
 6 files changed, ...
```

- [ ] **Step 3: Commit**

```bash
git commit -m "$(cat <<'EOF'
fix: replace getAllArticles with metadata-only query to reduce Supabase egress

- Add ArticleListItem type (Omit<Article, 'content' | 'htmlContent'>)
- Add getArticleListMetadata() with unstable_cache (1hr TTL, anon client)
- Fix getArticlesByCategory() to select metadata columns only
- Update getRelatedArticles, deriveCategories, filterArticlesByCategory signatures
- Swap 3 call sites: KB index, article page, admin KB page
- Add revalidate=3600 to KB index page

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 4: Push branch**

```bash
git push -u origin fix/kb-article-list-metadata
```

- [ ] **Step 5: Open PR**

```bash
gh pr create --title "fix: KB article list metadata query — reduce Supabase egress by ~95%" --body "$(cat <<'EOF'
## Summary

- Replaces `getAllArticles()` (returns full markdown `content` for every article) with a new `getArticleListMetadata()` function that selects only the 11 fields needed for list/card/sidebar views
- Wraps the query in `unstable_cache` (1-hour TTL) so Supabase is called at most once per hour regardless of traffic volume
- Fixes `getArticlesByCategory()` with the same column reduction
- Adds `export const revalidate = 3600` to the KB index page as belt-and-suspenders

## Why

The site exceeded the Supabase free-plan 5 GB/month uncached egress limit. `getAllArticles()` was called on every `/knowledge-base` page load (dynamic due to `searchParams`) and during every article page build, fetching the full markdown body (~8 KB) for every article on each call.

## UX impact

None for visitors. Publisher: new articles appear on KB index within 1 hour of publishing (cache TTL).

## Test plan

- [ ] TypeScript type-check passes (`npm run type-check`)
- [ ] KB index renders all article cards with correct category/tag/reading-time data
- [ ] Category filter and search work correctly
- [ ] Article detail page related-articles sidebar populates correctly
- [ ] Admin KB management page renders articles grouped by category

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: GitHub prints a PR URL. Share it for review before merging to `main`.
