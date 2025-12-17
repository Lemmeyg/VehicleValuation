# Knowledge Base - Complete File List

This document lists ALL files that need to be created or modified for the knowledge base implementation.

---

## Files to CREATE

### Content Directory Structure

```
content/
└── knowledge-base/
    ├── _template.md                                    ✅ Template for new articles
    │
    ├── getting-started/
    │   ├── understanding-vehicle-valuations.md
    │   ├── when-to-get-a-valuation-report.md
    │   └── how-vehicle-valuations-work.md
    │
    ├── total-loss-claims/
    │   ├── what-is-a-total-loss.md
    │   ├── how-insurance-calculates-acv.md
    │   ├── disputing-settlement-offers.md
    │   └── your-rights-in-total-loss-claims.md
    │
    ├── diminished-value/
    │   ├── what-is-diminished-value.md
    │   ├── how-to-claim-diminished-value.md
    │   └── calculating-diminished-value.md
    │
    ├── insurance-negotiations/
    │   ├── negotiating-with-insurance-adjusters.md
    │   ├── documentation-you-need.md
    │   └── common-settlement-mistakes.md
    │
    └── valuation-basics/
        ├── factors-affecting-vehicle-value.md
        └── regional-market-differences.md
```

**Total: 16 markdown files (1 template + 15 articles)**

---

### App Directory (Pages & Routing)

```
app/
└── knowledge-base/
    ├── page.tsx                           ✅ Knowledge base landing page
    ├── layout.tsx                         ✅ KB-specific layout
    │
    ├── [slug]/
    │   └── page.tsx                       ✅ Individual article page (dynamic)
    │
    ├── category/
    │   └── [name]/
    │       └── page.tsx                   ✅ Category archive page
    │
    └── tag/
        └── [name]/
            └── page.tsx                   ✅ Tag archive page
```

**Total: 5 page files**

---

### API Routes

```
app/
└── api/
    ├── og-image/
    │   └── route.tsx                      ✅ Open Graph image generator
    │
    └── feedback/
        └── route.ts                       ✅ Feedback widget API endpoint
```

**Total: 2 API routes**

---

### Components (Knowledge Base Specific)

```
components/
└── knowledge-base/
    ├── ArticleCard.tsx                    ✅ Article preview card
    ├── ArticleContent.tsx                 ✅ Markdown content renderer
    ├── ArticleHeader.tsx                  ✅ Article title, meta, breadcrumbs
    ├── ArticleList.tsx                    ✅ List of articles with filters
    ├── Breadcrumbs.tsx                    ✅ Breadcrumb navigation
    ├── CategoryBadge.tsx                  ✅ Category label component
    ├── CategoryGrid.tsx                   ✅ Category cards grid
    ├── FeedbackWidget.tsx                 ✅ "Was this helpful?" widget
    ├── KBHero.tsx                         ✅ Knowledge base hero section
    ├── KBSearch.tsx                       ✅ Search bar with live results
    ├── RelatedArticles.tsx                ✅ Related articles section
    ├── ShareButtons.tsx                   ✅ Social sharing buttons
    └── TableOfContents.tsx                ✅ Auto-generated TOC
```

**Total: 13 components**

---

### Library Utilities

```
lib/
├── knowledge-base.ts                      ✅ Article fetching & parsing utilities
├── markdown.ts                            ✅ Markdown processing utilities
├── search.ts                              ✅ Search functionality (Fuse.js)
└── seo.ts                                 ✅ SEO metadata generation utilities
```

**Total: 4 utility files**

---

### TypeScript Types

```
types/
└── knowledge-base.ts                      ✅ TypeScript interfaces & types
```

**Total: 1 type file**

---

### Sitemap & Metadata

```
app/
├── sitemap.ts                             ✅ Dynamic sitemap generator
└── robots.ts                              ✅ Robots.txt configuration
```

**Total: 2 files**

---

### Images Directory

```
public/
└── images/
    └── knowledge-base/
        ├── og-default.jpg                 ✅ Default OG image
        ├── category-getting-started.jpg
        ├── category-total-loss.jpg
        ├── category-diminished-value.jpg
        └── [article-specific-images].jpg  (as needed)
```

**Total: 4+ image files**

---

## Files to MODIFY

### 1. `package.json`

**Add dependencies:**

```json
{
  "dependencies": {
    "gray-matter": "^4.0.3",
    "remark": "^15.0.1",
    "remark-gfm": "^4.0.0",
    "remark-html": "^16.0.1",
    "rehype-highlight": "^7.0.0",
    "rehype-slug": "^6.0.0",
    "rehype-autolink-headings": "^7.1.0",
    "fuse.js": "^7.0.0",
    "reading-time": "^1.5.0",
    "@vercel/og": "^0.6.2"
  }
}
```

---

### 2. `components/Navbar.tsx`

**Add knowledge base link to navigation:**

```tsx
<nav>
  <Link href="/">Home</Link>
  <Link href="/#features">Features</Link>
  <Link href="/knowledge-base">Knowledge Base</Link> {/* ← ADD THIS */}
  <Link href="/#pricing">Pricing</Link>
  <Link href="/dashboard">Dashboard</Link>
</nav>
```

---

### 3. `components/Footer.tsx`

**Add knowledge base section:**

```tsx
<div>
  <h4 className="font-bold mb-4">Resources</h4>
  <ul>
    <li>
      <Link href="/knowledge-base">Knowledge Base</Link>
    </li>
    <li>
      <Link href="/knowledge-base/category/getting-started">Getting Started</Link>
    </li>
    <li>
      <Link href="/knowledge-base/category/total-loss-claims">Total Loss Claims</Link>
    </li>
    <li>
      <Link href="/knowledge-base/category/diminished-value">Diminished Value</Link>
    </li>
  </ul>
</div>
```

---

### 4. `components/KnowledgeBase.tsx` (existing homepage section)

**Enhance to link to the new knowledge base:**

```tsx
import { getFeaturedArticles } from '@/lib/knowledge-base'
import ArticleCard from '@/components/knowledge-base/ArticleCard'

export default async function KnowledgeBase() {
  const featuredArticles = await getFeaturedArticles(3)

  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4">
        <h2 className="text-3xl font-bold mb-8">Knowledge Base</h2>

        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {featuredArticles.map(article => (
            <ArticleCard key={article.slug} {...article} />
          ))}
        </div>

        <div className="text-center">
          <Link href="/knowledge-base" className="btn-primary">
            View All Articles
          </Link>
        </div>
      </div>
    </section>
  )
}
```

---

### 5. `app/layout.tsx`

**Update metadata for better SEO:**

```tsx
export const metadata: Metadata = {
  title: {
    default: 'Vehicle Valuation Authority - Independent Market Valuations',
    template: '%s | Vehicle Valuation Authority',
  },
  description:
    'Get independent, data-backed vehicle valuations. Professional reports for total loss claims, diminished value, and insurance negotiations.',
  keywords: ['vehicle valuation', 'total loss', 'diminished value', 'insurance settlement'],
}
```

---

### 6. `middleware.ts` (if not already handling knowledge-base routes)

**Ensure knowledge base routes are accessible:**

```tsx
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow public access to knowledge base
  if (pathname.startsWith('/knowledge-base')) {
    return NextResponse.next()
  }

  // Existing middleware logic...
}
```

---

### 7. `.gitignore`

**Ensure content directory is tracked:**

```
# Dependencies
node_modules/

# Next.js
.next/
out/

# Keep content directory tracked
!content/
```

---

### 8. `app/globals.css`

**Add knowledge base specific styles (optional, if needed):**

```css
/* Knowledge Base Article Styles */
.prose {
  @apply max-w-none;
}

.prose h2 {
  @apply text-2xl font-bold mt-8 mb-4 text-slate-900;
}

.prose h3 {
  @apply text-xl font-bold mt-6 mb-3 text-slate-800;
}

.prose p {
  @apply mb-4 leading-relaxed text-slate-700;
}

.prose ul,
.prose ol {
  @apply mb-4 ml-6;
}

.prose li {
  @apply mb-2;
}

.prose a {
  @apply text-primary-600 hover:text-primary-700 underline;
}

.prose code {
  @apply bg-slate-100 px-1 py-0.5 rounded text-sm font-mono;
}

.prose pre {
  @apply bg-slate-900 text-white p-4 rounded-lg overflow-x-auto mb-4;
}

.prose table {
  @apply w-full border-collapse mb-4;
}

.prose th {
  @apply bg-slate-100 font-bold p-2 text-left border border-slate-300;
}

.prose td {
  @apply p-2 border border-slate-300;
}

.prose blockquote {
  @apply border-l-4 border-primary-600 pl-4 italic text-slate-600 my-4;
}

/* Table of Contents Active Link */
.toc-link-active {
  @apply text-primary-600 font-medium;
}

/* Search Highlight */
mark {
  @apply bg-yellow-200 px-1;
}
```

---

### 9. `supabase/migrations/` (new migration file)

**Create database table for feedback:**

**File:** `supabase/migrations/YYYYMMDD_create_article_feedback.sql`

```sql
-- Create article_feedback table
CREATE TABLE IF NOT EXISTS article_feedback (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  article_slug TEXT NOT NULL,
  helpful BOOLEAN NOT NULL,
  comment TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add index for faster queries
CREATE INDEX idx_article_feedback_slug ON article_feedback(article_slug);
CREATE INDEX idx_article_feedback_created_at ON article_feedback(created_at DESC);

-- Enable Row Level Security
ALTER TABLE article_feedback ENABLE ROW LEVEL SECURITY;

-- Policy: Allow anonymous inserts (feedback can be submitted without login)
CREATE POLICY "Allow anonymous feedback submission"
  ON article_feedback
  FOR INSERT
  TO public
  WITH CHECK (true);

-- Policy: Allow users to view their own feedback
CREATE POLICY "Users can view own feedback"
  ON article_feedback
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy: Admins can view all feedback
CREATE POLICY "Admins can view all feedback"
  ON article_feedback
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND raw_user_meta_data->>'is_admin' = 'true'
    )
  );

-- Add trigger for updated_at
CREATE TRIGGER update_article_feedback_updated_at
  BEFORE UPDATE ON article_feedback
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

---

## Installation Commands

### 1. Install Dependencies

```bash
npm install gray-matter remark remark-gfm remark-html rehype-highlight rehype-slug rehype-autolink-headings fuse.js reading-time @vercel/og
```

### 2. Create Directory Structure

```bash
# Create content directories
mkdir -p content/knowledge-base/getting-started
mkdir -p content/knowledge-base/total-loss-claims
mkdir -p content/knowledge-base/diminished-value
mkdir -p content/knowledge-base/insurance-negotiations
mkdir -p content/knowledge-base/valuation-basics

# Create component directories
mkdir -p components/knowledge-base

# Create lib directories (already exist)
# No action needed

# Create types directory (already exists)
# No action needed

# Create images directory
mkdir -p public/images/knowledge-base
```

### 3. Create App Routes

```bash
# Create knowledge base app directories
mkdir -p app/knowledge-base/\[slug\]
mkdir -p app/knowledge-base/category/\[name\]
mkdir -p app/knowledge-base/tag/\[name\]

# Create API routes
mkdir -p app/api/og-image
mkdir -p app/api/feedback
```

---

## Summary

### Total Files to Create: 47

| Category          | Count |
| ----------------- | ----- |
| Markdown Content  | 16    |
| Page Components   | 5     |
| API Routes        | 2     |
| React Components  | 13    |
| Utility Libraries | 4     |
| TypeScript Types  | 1     |
| Sitemap/Metadata  | 2     |
| Images            | 4+    |

### Total Files to Modify: 9

| File               | Purpose                  |
| ------------------ | ------------------------ |
| package.json       | Add dependencies         |
| Navbar.tsx         | Add KB link              |
| Footer.tsx         | Add KB section           |
| KnowledgeBase.tsx  | Enhance homepage section |
| layout.tsx         | Update metadata          |
| middleware.ts      | Handle KB routes         |
| .gitignore         | Track content            |
| globals.css        | Add KB styles            |
| Supabase migration | Feedback table           |

---

## Estimated Implementation Time

| Phase                        | Duration       | Files        |
| ---------------------------- | -------------- | ------------ |
| Phase 1: Core Infrastructure | 1-2 days       | 5 files      |
| Phase 2: Article Pages       | 2-3 days       | 8 files      |
| Phase 3: Landing Page        | 1-2 days       | 6 files      |
| Phase 4: SEO Optimization    | 2-3 days       | 7 files      |
| Phase 5: Search & Discovery  | 2 days         | 5 files      |
| Phase 6: Engagement Features | 1-2 days       | 4 files      |
| Phase 7: Content Creation    | 3-4 days       | 16 files     |
| Phase 8: Testing & Launch    | 1-2 days       | -            |
| **Total**                    | **13-20 days** | **56 files** |

---

## Next Steps

1. **Review File List:** Confirm all files are needed
2. **Install Dependencies:** Run npm install command
3. **Create Directory Structure:** Run mkdir commands
4. **Start Phase 1:** Build core infrastructure files
5. **Iterate:** Build incrementally, test frequently

**Ready to begin implementation?**
