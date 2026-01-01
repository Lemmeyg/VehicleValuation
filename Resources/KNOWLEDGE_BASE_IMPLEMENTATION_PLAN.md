# Knowledge Base Implementation Plan

## SEO-Optimized Markdown File System

**Version:** 1.0
**Created:** December 12, 2024
**Status:** Ready for Implementation

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [System Architecture](#system-architecture)
3. [Directory Structure](#directory-structure)
4. [Technical Stack](#technical-stack)
5. [Implementation Phases](#implementation-phases)
6. [SEO Strategy](#seo-strategy)
7. [LLM Optimization](#llm-optimization)
8. [File Structure & Templates](#file-structure--templates)
9. [Component Architecture](#component-architecture)
10. [Integration Points](#integration-points)

---

## Executive Summary

### Goals

Build a publicly accessible knowledge base that:

- Provides value to users researching vehicle valuations and total loss claims
- Drives organic traffic through SEO optimization
- Is discoverable by LLMs and AI search engines
- Remains easy to update via markdown file uploads
- Maintains consistent branding with the existing platform

### Target Audience (ICP)

- Vehicle owners dealing with total loss claims
- People researching diminished value
- Consumers comparing settlement offers
- Users seeking advice on insurance negotiations

### Key Features

- File-based markdown system with YAML frontmatter
- Dynamic page generation at build time (Static Site Generation)
- Full-text search functionality
- Category and tag-based organization
- Schema.org structured data
- Auto-generated Open Graph images
- Mobile-responsive design
- Fast page loads (<2s)

---

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    User Browser                         │
└─────────────────────────────────────────────────────────┘
                           │
                           ↓
┌─────────────────────────────────────────────────────────┐
│              Next.js App Router (SSG)                    │
│  ┌───────────────────────────────────────────────────┐  │
│  │  /knowledge-base (Landing Page)                   │  │
│  │  /knowledge-base/[slug] (Article Pages)           │  │
│  │  /knowledge-base/category/[name]                  │  │
│  │  /knowledge-base/tag/[name]                       │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                           │
                           ↓
┌─────────────────────────────────────────────────────────┐
│          Markdown Processing Layer                       │
│  ┌───────────────────────────────────────────────────┐  │
│  │  - Gray Matter (frontmatter parsing)              │  │
│  │  - Remark/Rehype (markdown to HTML)               │  │
│  │  - Reading time calculation                       │  │
│  │  - Table of contents generation                   │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                           │
                           ↓
┌─────────────────────────────────────────────────────────┐
│              File System (Content Storage)               │
│  /content/knowledge-base/                                │
│    ├── getting-started/                                  │
│    ├── total-loss-claims/                                │
│    ├── diminished-value/                                 │
│    ├── insurance-negotiations/                           │
│    └── valuation-basics/                                 │
└─────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Build Time** (Next.js SSG):
   - Scan `/content/knowledge-base/` directory
   - Parse all `.md` files
   - Extract frontmatter metadata
   - Generate static pages for each article
   - Build category/tag archive pages
   - Generate sitemap.xml

2. **Runtime** (User Request):
   - Serve pre-rendered static HTML
   - Client-side search via Fuse.js
   - Analytics tracking (Google Analytics 4)
   - Feedback widget interactions

3. **Content Update Flow**:
   - Add/update `.md` file in `/content/knowledge-base/`
   - Commit to Git
   - Vercel auto-deploys and rebuilds
   - New/updated articles go live

---

## Directory Structure

```
vehicle-valuation-saas/
├── app/
│   ├── knowledge-base/
│   │   ├── page.tsx                    # Landing page
│   │   ├── layout.tsx                  # Knowledge base layout
│   │   ├── [slug]/
│   │   │   └── page.tsx                # Individual article page
│   │   ├── category/
│   │   │   └── [name]/
│   │   │       └── page.tsx            # Category archive
│   │   └── tag/
│   │       └── [name]/
│   │           └── page.tsx            # Tag archive
│   └── api/
│       ├── og-image/                   # Open Graph image generation
│       │   └── route.tsx
│       └── feedback/                   # Feedback widget API
│           └── route.ts
├── components/
│   ├── knowledge-base/
│   │   ├── ArticleCard.tsx             # Article preview card
│   │   ├── ArticleContent.tsx          # Rendered markdown content
│   │   ├── ArticleHeader.tsx           # Title, meta, breadcrumbs
│   │   ├── CategoryBadge.tsx           # Category label
│   │   ├── FeedbackWidget.tsx          # "Was this helpful?" widget
│   │   ├── KBSearch.tsx                # Search bar component
│   │   ├── RelatedArticles.tsx         # Related articles section
│   │   ├── ShareButtons.tsx            # Social sharing buttons
│   │   └── TableOfContents.tsx         # Auto-generated TOC
│   └── ui/                             # Existing shadcn/ui components
├── content/
│   └── knowledge-base/
│       ├── _template.md                # Template for new articles
│       ├── getting-started/
│       │   ├── understanding-vehicle-valuations.md
│       │   └── when-to-get-a-valuation-report.md
│       ├── total-loss-claims/
│       │   ├── what-is-a-total-loss.md
│       │   ├── how-insurance-calculates-acv.md
│       │   └── disputing-settlement-offers.md
│       ├── diminished-value/
│       │   ├── what-is-diminished-value.md
│       │   └── how-to-claim-diminished-value.md
│       ├── insurance-negotiations/
│       │   ├── negotiating-with-adjusters.md
│       │   └── documentation-you-need.md
│       └── valuation-basics/
│           ├── factors-affecting-value.md
│           └── regional-market-differences.md
├── lib/
│   ├── markdown.ts                     # Markdown processing utilities
│   ├── knowledge-base.ts               # Article fetching & parsing
│   ├── search.ts                       # Search functionality
│   └── seo.ts                          # SEO metadata generation
├── public/
│   └── images/
│       └── knowledge-base/             # Article images
└── types/
    └── knowledge-base.ts               # TypeScript types
```

---

## Technical Stack

### Core Dependencies

```json
{
  "dependencies": {
    // Existing dependencies
    "next": "^16.0.10",
    "react": "19.2.1",
    "react-dom": "19.2.1",

    // Markdown processing
    "gray-matter": "^4.0.3",
    "remark": "^15.0.1",
    "remark-gfm": "^4.0.0",
    "remark-html": "^16.0.1",
    "rehype-highlight": "^7.0.0",
    "rehype-slug": "^6.0.0",
    "rehype-autolink-headings": "^7.1.0",

    // Search
    "fuse.js": "^7.0.0",

    // Utilities
    "reading-time": "^1.5.0",
    "date-fns": "^4.1.0", // Already installed

    // Open Graph images
    "@vercel/og": "^0.6.2"
  }
}
```

### Why These Dependencies?

- **gray-matter**: Parse YAML frontmatter from markdown files
- **remark/rehype**: Industry-standard markdown processing pipeline
- **remark-gfm**: GitHub Flavored Markdown support (tables, task lists)
- **rehype-highlight**: Syntax highlighting for code blocks
- **rehype-slug**: Auto-generate heading IDs for anchor links
- **rehype-autolink-headings**: Add clickable links to headings
- **fuse.js**: Fast, lightweight fuzzy search (client-side)
- **reading-time**: Calculate estimated reading time
- **@vercel/og**: Generate dynamic Open Graph images

---

## Implementation Phases

### Phase 1: Core Infrastructure (Week 1)

**Tasks:**

1. Install dependencies
2. Create directory structure
3. Set up TypeScript types
4. Build markdown processing utilities
5. Create article template file

**Deliverables:**

- `/content/knowledge-base/` directory with template
- `lib/markdown.ts` - markdown parser
- `lib/knowledge-base.ts` - article utilities
- `types/knowledge-base.ts` - TypeScript types

---

### Phase 2: Article Pages (Week 1-2)

**Tasks:**

1. Build article page template (`[slug]/page.tsx`)
2. Implement dynamic routing
3. Create article components (header, content, TOC)
4. Add breadcrumb navigation
5. Style with Tailwind CSS (match existing brand)

**Deliverables:**

- `/app/knowledge-base/[slug]/page.tsx`
- Article header component
- Table of contents component
- Markdown content renderer

---

### Phase 3: Landing Page & Navigation (Week 2)

**Tasks:**

1. Build knowledge base landing page
2. Create search bar component
3. Build category grid/cards
4. Implement featured articles section
5. Add "All Articles" list with filters

**Deliverables:**

- `/app/knowledge-base/page.tsx`
- Search component
- Category/tag filter UI
- Article card components

---

### Phase 4: SEO Optimization (Week 2-3)

**Tasks:**

1. Implement dynamic meta tags
2. Add Schema.org structured data (Article, Breadcrumb, Organization)
3. Build Open Graph image generator
4. Generate sitemap.xml
5. Add canonical URLs

**Deliverables:**

- `lib/seo.ts` - SEO utilities
- `/app/api/og-image/route.tsx` - OG image API
- `app/sitemap.ts` - sitemap generator
- Meta tag implementation

---

### Phase 5: Search & Discovery (Week 3)

**Tasks:**

1. Implement client-side search with Fuse.js
2. Build category archive pages
3. Build tag archive pages
4. Add search result highlighting
5. Optimize search performance

**Deliverables:**

- `lib/search.ts` - search utilities
- `/app/knowledge-base/category/[name]/page.tsx`
- `/app/knowledge-base/tag/[name]/page.tsx`
- Search component with live results

---

### Phase 6: Engagement Features (Week 3-4)

**Tasks:**

1. Build "Was this helpful?" feedback widget
2. Add social sharing buttons
3. Implement related articles algorithm
4. Add analytics tracking events
5. Create feedback API endpoint

**Deliverables:**

- Feedback widget component
- Share buttons component
- Related articles component
- `/app/api/feedback/route.ts`
- GA4 event tracking

---

### Phase 7: Content Creation & Testing (Week 4)

**Tasks:**

1. Write 10-15 seed articles
2. Optimize images for web
3. Test all page templates
4. Verify SEO metadata
5. Test search functionality
6. Mobile responsiveness testing

**Deliverables:**

- 10-15 published articles
- Optimized images in `/public/images/knowledge-base/`
- QA testing report
- Performance audit report

---

### Phase 8: Launch & Monitoring (Week 4)

**Tasks:**

1. Submit sitemap to Google Search Console
2. Verify structured data with Rich Results Test
3. Set up analytics dashboards
4. Monitor feedback widget responses
5. Track search queries
6. Performance monitoring

**Deliverables:**

- Google Search Console integration
- Analytics dashboard setup
- Performance baseline metrics
- Launch announcement

---

## SEO Strategy

### On-Page SEO Checklist

#### Meta Tags (Per Article)

```tsx
<head>
  <title>{article.title} | Vehicle Valuation Authority</title>
  <meta name="description" content={article.description} />
  <link rel="canonical" href={`https://yoursite.com/knowledge-base/${article.slug}`} />

  {/* Open Graph */}
  <meta property="og:type" content="article" />
  <meta property="og:title" content={article.title} />
  <meta property="og:description" content={article.description} />
  <meta property="og:url" content={canonicalUrl} />
  <meta property="og:image" content={ogImageUrl} />
  <meta property="article:published_time" content={article.datePublished} />
  <meta property="article:modified_time" content={article.dateModified} />
  <meta property="article:author" content={article.author} />

  {/* Twitter Card */}
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content={article.title} />
  <meta name="twitter:description" content={article.description} />
  <meta name="twitter:image" content={ogImageUrl} />
</head>
```

#### Schema.org Structured Data

**Article Schema:**

```json
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "Understanding Total Loss Claims",
  "description": "Learn how insurance companies calculate total loss...",
  "image": "https://yoursite.com/og-image/article-slug.png",
  "datePublished": "2024-01-15T08:00:00Z",
  "dateModified": "2024-01-20T10:30:00Z",
  "author": {
    "@type": "Organization",
    "name": "Vehicle Valuation Authority"
  },
  "publisher": {
    "@type": "Organization",
    "name": "Vehicle Valuation Authority",
    "logo": {
      "@type": "ImageObject",
      "url": "https://yoursite.com/logo.png"
    }
  },
  "mainEntityOfPage": {
    "@type": "WebPage",
    "@id": "https://yoursite.com/knowledge-base/article-slug"
  },
  "articleSection": "Total Loss Claims",
  "keywords": ["total loss", "insurance", "vehicle valuation"]
}
```

**Breadcrumb Schema:**

```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Home",
      "item": "https://yoursite.com"
    },
    {
      "@type": "ListItem",
      "position": 2,
      "name": "Knowledge Base",
      "item": "https://yoursite.com/knowledge-base"
    },
    {
      "@type": "ListItem",
      "position": 3,
      "name": "Total Loss Claims",
      "item": "https://yoursite.com/knowledge-base/category/total-loss-claims"
    },
    {
      "@type": "ListItem",
      "position": 4,
      "name": "Understanding Total Loss Claims"
    }
  ]
}
```

**FAQ Schema (when applicable):**

```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "What is a total loss?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "A total loss occurs when the cost to repair a vehicle..."
      }
    }
  ]
}
```

#### Sitemap.xml Structure

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <!-- Knowledge Base Landing -->
  <url>
    <loc>https://yoursite.com/knowledge-base</loc>
    <lastmod>2024-01-20</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>

  <!-- Articles -->
  <url>
    <loc>https://yoursite.com/knowledge-base/article-slug</loc>
    <lastmod>2024-01-20</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>

  <!-- Category Archives -->
  <url>
    <loc>https://yoursite.com/knowledge-base/category/total-loss-claims</loc>
    <lastmod>2024-01-20</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
</urlset>
```

**Maximum Levels:** 3-4

- Level 1: Home
- Level 2: Knowledge Base
- Level 3: Category / Article
- Level 4: (Avoid - keep flat structure)

---

## LLM Optimization

### Best Practices for AI Discoverability

#### 1. Clear, Descriptive Headings

```markdown
# Understanding Total Loss Claims

## What is a Total Loss?

A total loss occurs when...

## How Insurance Companies Calculate Total Loss

Insurance adjusters use several methods...

## Your Rights When Disputing a Total Loss

You have the legal right to...
```

#### 2. Semantic HTML5 Structure

```tsx
<article>
  <header>
    <h1>Article Title</h1>
    <p className="lead">Introductory paragraph</p>
  </header>

  <section id="what-is-total-loss">
    <h2>What is a Total Loss?</h2>
    <p>...</p>
  </section>

  <aside>
    <h3>Key Takeaways</h3>
    <ul>...</ul>
  </aside>
</article>
```

#### 3. Concise Introductions

Every article should start with:

- **First sentence:** Direct answer to the topic
- **First paragraph:** Context and why it matters
- **Second paragraph:** What the reader will learn

Example:

```markdown
# Understanding Total Loss Claims

A total loss claim occurs when an insurance company determines that
repairing your vehicle costs more than its actual cash value. This
decision has significant financial implications for vehicle owners.

In this guide, you'll learn how insurance companies calculate total
loss, what your rights are, and how to dispute an offer you believe
is too low. We'll also explain how independent valuations can
strengthen your negotiating position.
```

#### 4. Structured Lists and Tables

**Use Lists for:**

- Step-by-step processes
- Key points
- Checklists

**Use Tables for:**

- Comparisons
- Data presentation
- Feature matrices

Example:

```markdown
## Factors That Affect Vehicle Value

| Factor    | Impact     | Notes                                     |
| --------- | ---------- | ----------------------------------------- |
| Mileage   | High       | Every 10,000 miles reduces value by ~$500 |
| Condition | High       | Pre-accident condition is critical        |
| Location  | Medium     | Regional market variations can be 10-15%  |
| Features  | Low-Medium | Premium features add 5-10% value          |
```

#### 5. FAQ Sections

Include FAQ sections where relevant:

```markdown
## Frequently Asked Questions

**Q: How long does a total loss claim take?**
A: Most total loss claims are settled within 2-4 weeks, but complex
cases can take 30-60 days.

**Q: Can I keep my car after a total loss?**
A: Yes, you can typically buy back your totaled vehicle from the
insurance company at the salvage value.
```

#### 6. Internal Linking with Context

```markdown
Learn more about [how insurance companies calculate ACV](../total-loss-claims/how-insurance-calculates-acv.md)
and why independent valuations matter.

For a detailed breakdown of factors affecting vehicle value, see our guide on
[valuation basics](../valuation-basics/factors-affecting-value.md).
```

---

## File Structure & Templates

### Frontmatter Structure

**Required Fields:**

```yaml
---
title: 'Understanding Total Loss Claims'
description: 'Learn how insurance companies determine total loss, your rights, and how to dispute settlement offers.'
category: 'Total Loss Claims'
tags: ['total loss', 'insurance', 'settlement', 'negotiation']
author: 'Vehicle Valuation Authority'
datePublished: '2024-01-15'
dateModified: '2024-01-20'
featured: false
slug: 'understanding-total-loss-claims'
---
```

**Optional Fields:**

```yaml
featuredImage: '/images/knowledge-base/total-loss-guide.jpg'
readingTime: 8 # Auto-calculated if omitted
relatedArticles: ['how-insurance-calculates-acv', 'disputing-settlement-offers']
published: true # Default: true; set false for drafts
```

### Article Template

**File:** `/content/knowledge-base/_template.md`

```markdown
---
title: 'Your Article Title'
description: '150-160 character meta description optimized for search results and social sharing.'
category: 'Category Name'
tags: ['tag1', 'tag2', 'tag3']
author: 'Vehicle Valuation Authority'
datePublished: '2024-01-15'
dateModified: '2024-01-15'
featured: false
slug: 'url-friendly-slug'
---

# Your Article Title

**Lead paragraph:** Start with a clear, concise introduction that directly
addresses the topic. This paragraph should answer the "what" and "why"
immediately. Aim for 2-3 sentences.

In this guide, you'll learn [specific outcomes the reader will achieve].
We'll cover [main topics] and provide actionable steps to [desired result].

## Main Section 1

Start with context and background. Use clear, simple language that a
non-expert can understand.

### Subsection 1.1

Break down complex topics into digestible chunks. Use examples where possible.

**Example:** When calculating total loss, insurance companies typically use
this formula:
```

Total Loss = Repair Cost > (ACV - Salvage Value)

```

## Main Section 2

Continue building on the previous section. Maintain a logical flow.

### Key Takeaways

- Bullet point 1: Clear, actionable insight
- Bullet point 2: Specific data or recommendation
- Bullet point 3: Next steps or further reading

## Frequently Asked Questions

**Q: Common question users ask?**
A: Direct, complete answer in 2-3 sentences.

**Q: Another common question?**
A: Clear answer with specific details.

## Next Steps

Provide clear direction on what the reader should do next:

1. [Specific action item]
2. [Link to related resource]
3. [Call to action - e.g., "Get your vehicle valuation report"]

---

**Need help with your vehicle valuation?** [Get a professional report](https://yoursite.com/reports/new)
backed by comprehensive market data and expert analysis.
```

### Image Formatting in Markdown

```markdown
## How to Add Images

### Standard Image

![Descriptive alt text](../../../public/images/knowledge-base/image-name.jpg)

### Image with Caption

![Vehicle valuation comparison chart](../../../public/images/knowledge-base/valuation-chart.jpg)
_Figure 1: Comparison of valuation methods across different data sources_

### Responsive Images (using Next.js Image component)

Note: Requires custom MDX component mapping
<Image
  src="/images/knowledge-base/settlement-process.jpg"
  alt="Settlement process flowchart"
  width={800}
  height={600}
/>
```

**Image Guidelines:**

- Max file size: 200KB per image
- Format: WebP or JPEG
- Dimensions: 1200x800px (landscape), 800x1200px (portrait)
- Alt text: Descriptive, include keywords naturally
- File naming: `kebab-case-descriptive-name.jpg`

---

## Component Architecture

### 1. ArticleCard Component

**Purpose:** Display article preview in lists/grids

**Props:**

```tsx
interface ArticleCardProps {
  title: string
  description: string
  category: string
  slug: string
  datePublished: string
  readingTime: number
  featured?: boolean
}
```

**Features:**

- Hover effects
- Category badge
- Reading time indicator
- Publication date
- Featured badge (if applicable)

---

### 2. TableOfContents Component

**Purpose:** Auto-generate TOC from headings

**Props:**

```tsx
interface TOCProps {
  headings: Array<{
    id: string
    text: string
    level: 2 | 3 // H2 and H3 only
  }>
}
```

**Features:**

- Smooth scroll to anchors
- Active heading highlighting
- Sticky positioning on desktop
- Collapse/expand on mobile

---

### 3. FeedbackWidget Component

**Purpose:** "Was this helpful?" feedback collection

**Props:**

```tsx
interface FeedbackWidgetProps {
  articleSlug: string
}
```

**Features:**

- Yes/No buttons
- Optional comment field (appears on "No")
- Thank you message after submission
- Analytics event tracking

**API Endpoint:**

```tsx
// POST /api/feedback
{
  articleSlug: string
  helpful: boolean
  comment?: string
  timestamp: Date
}
```

**Data Storage:**

- Store in Supabase `article_feedback` table
- Track: article_slug, helpful (boolean), comment, user_id (if logged in), created_at

---

### 4. RelatedArticles Component

**Purpose:** Suggest 3-4 related articles

**Algorithm:**

```tsx
function getRelatedArticles(currentArticle, allArticles) {
  // Priority 1: Same category + matching tags
  const sameCategoryMatchingTags = allArticles.filter(
    a =>
      a.category === currentArticle.category &&
      a.tags.some(tag => currentArticle.tags.includes(tag)) &&
      a.slug !== currentArticle.slug
  )

  // Priority 2: Same category only
  const sameCategory = allArticles.filter(
    a => a.category === currentArticle.category && a.slug !== currentArticle.slug
  )

  // Priority 3: Matching tags, different category
  const matchingTags = allArticles.filter(
    a => a.tags.some(tag => currentArticle.tags.includes(tag)) && a.slug !== currentArticle.slug
  )

  // Combine and deduplicate, take top 4
  return [...sameCategoryMatchingTags, ...sameCategory, ...matchingTags]
    .filter((article, index, self) => index === self.findIndex(a => a.slug === article.slug))
    .slice(0, 4)
}
```

---

### 5. KBSearch Component

**Purpose:** Client-side search with live results

**Features:**

- Fuzzy search (Fuse.js)
- Search titles, descriptions, content
- Highlight matching terms
- Debounced input (300ms)
- Keyboard navigation (arrow keys, enter)

**Search Configuration:**

```tsx
const fuseOptions = {
  keys: [
    { name: 'title', weight: 3 },
    { name: 'description', weight: 2 },
    { name: 'content', weight: 1 },
    { name: 'tags', weight: 1.5 },
  ],
  threshold: 0.3, // 0-1, lower = stricter
  includeScore: true,
  minMatchCharLength: 2,
}
```

---

### 6. ShareButtons Component

**Purpose:** Social sharing functionality

**Platforms:**

- Twitter/X
- LinkedIn
- Facebook
- Copy link

**Implementation:**

```tsx
const shareUrls = {
  twitter: `https://twitter.com/intent/tweet?text=${title}&url=${url}`,
  linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${url}`,
  facebook: `https://www.facebook.com/sharer/sharer.php?u=${url}`,
}
```

---

## Integration Points

### 1. Navigation Integration

Add knowledge base link to main navigation:

**File:** `components/Navbar.tsx`

```tsx
<nav>
  <Link href="/">Home</Link>
  <Link href="/#features">Features</Link>
  <Link href="/knowledge-base">Knowledge Base</Link>
  <Link href="/#pricing">Pricing</Link>
  <Link href="/dashboard">Dashboard</Link>
</nav>
```

### 2. Analytics Integration

**Google Analytics 4 Events:**

```tsx
// Article view
gtag('event', 'article_view', {
  article_title: 'Understanding Total Loss Claims',
  article_category: 'Total Loss Claims',
  article_slug: 'understanding-total-loss-claims',
})

// Search performed
gtag('event', 'kb_search', {
  search_term: 'diminished value',
  results_count: 12,
})

// Feedback submitted
gtag('event', 'article_feedback', {
  article_slug: 'understanding-total-loss-claims',
  helpful: true,
})

// Related article clicked
gtag('event', 'related_article_click', {
  from_article: 'understanding-total-loss-claims',
  to_article: 'how-insurance-calculates-acv',
})

// Social share
gtag('event', 'share', {
  method: 'twitter',
  content_type: 'article',
  item_id: 'understanding-total-loss-claims',
})
```

### 3. Footer Integration

Add knowledge base section to footer:

**File:** `components/Footer.tsx`

```tsx
<footer>
  <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
    {/* Existing footer sections */}

    {/* Knowledge Base Section */}
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
  </div>
</footer>
```

### 4. Homepage Integration

**Already exists:** `components/KnowledgeBase.tsx`

Enhance to link to the new knowledge base:

```tsx
<section className="py-20 bg-white">
  <div className="max-w-7xl mx-auto px-4">
    <h2 className="text-3xl font-bold mb-8">Knowledge Base</h2>
    <p className="text-lg text-slate-600 mb-8">
      Learn everything you need to know about vehicle valuations and total loss claims
    </p>

    {/* Featured Articles Grid */}
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
```

### 5. Conversion Opportunities

Add CTAs within articles:

```markdown
## Next Steps

Now that you understand how total loss claims work, **get an independent
valuation** to ensure you receive a fair settlement offer.

[Get Your Valuation Report →](/reports/new)
```

**Inline CTAs:**

- After explaining a problem → Offer solution (valuation report)
- In FAQ sections → Link to report
- End of article → Primary CTA

**Ad-hoc CTA Component:**

```tsx
<aside className="bg-primary-50 border-l-4 border-primary-600 p-6 my-8">
  <h3 className="text-xl font-bold mb-2">Need a Professional Valuation?</h3>
  <p className="text-slate-700 mb-4">
    Get an independent, data-backed vehicle valuation report in 24-48 hours.
  </p>
  <Link href="/reports/new" className="btn-primary">
    Get Started
  </Link>
</aside>
```

---

## Performance Optimization

### Build Performance

**Static Site Generation (SSG):**

- All articles pre-rendered at build time
- No runtime markdown processing
- Fast page loads (<1s FCP)

**Image Optimization:**

- Next.js Image component
- WebP format with JPEG fallback
- Lazy loading below fold
- Responsive srcsets

**Code Splitting:**

- Dynamic imports for heavy components
- Search component loaded on demand
- Feedback widget lazy loaded

### Runtime Performance

**Target Metrics:**

- **First Contentful Paint (FCP):** <1.8s
- **Largest Contentful Paint (LCP):** <2.5s
- **Cumulative Layout Shift (CLS):** <0.1
- **Time to Interactive (TTI):** <3.5s

**Optimization Strategies:**

- Minimize JavaScript bundle size
- Use font-display: swap
- Preload critical assets
- Implement service worker (future)

---

## Content Strategy

### Initial Content (15 Articles)

**Getting Started (3 articles):**

1. Understanding Vehicle Valuations
2. When to Get a Valuation Report
3. How Vehicle Valuations Work

**Total Loss Claims (4 articles):**

1. What is a Total Loss?
2. How Insurance Calculates ACV
3. Disputing Settlement Offers
4. Your Rights in Total Loss Claims

**Diminished Value (3 articles):**

1. What is Diminished Value?
2. How to Claim Diminished Value
3. Calculating Diminished Value

**Insurance Negotiations (3 articles):**

1. Negotiating with Insurance Adjusters
2. Documentation You Need
3. Common Settlement Mistakes

**Valuation Basics (2 articles):**

1. Factors Affecting Vehicle Value
2. Regional Market Differences

### Content Calendar

**Month 1:**

- Publish all 15 seed articles
- Submit sitemap to Google

**Month 2:**

- Add 5 new articles
- Update existing based on search queries

**Month 3:**

- Add 5 new articles
- Analyze performance, optimize top performers

**Ongoing:**

- Publish 3-5 articles per month
- Update articles quarterly
- Monitor search rankings
- Respond to user feedback

---

## Success Metrics

### SEO Metrics (Track Monthly)

- **Organic traffic:** Sessions from search engines
- **Keyword rankings:** Top 3, Top 10, Top 20 positions
- **Click-through rate (CTR):** From search results
- **Average position:** Google Search Console
- **Indexed pages:** Total articles in Google index
- **Backlinks:** External sites linking to articles

**Targets:**

- Month 1: 100+ organic sessions
- Month 3: 500+ organic sessions
- Month 6: 2,000+ organic sessions
- Year 1: 10,000+ organic sessions

### Engagement Metrics

- **Average time on page:** >2 minutes (indicates quality)
- **Bounce rate:** <60% (lower is better)
- **Pages per session:** >1.5 (indicates exploration)
- **Scroll depth:** >75% (readers finishing articles)
- **Feedback score:** >80% "helpful" responses

### Conversion Metrics

- **KB → Report CTA clicks:** Track conversions from articles
- **Revenue attribution:** Sales from KB traffic
- **Lead generation:** Email signups from KB

---

## Launch Checklist

### Pre-Launch

- [ ] All 15 seed articles written and reviewed
- [ ] Images optimized and uploaded
- [ ] All components built and tested
- [ ] SEO metadata verified (titles, descriptions, OG images)
- [ ] Structured data validated (Google Rich Results Test)
- [ ] Sitemap generated and tested
- [ ] Mobile responsiveness verified
- [ ] Search functionality tested
- [ ] Analytics tracking implemented
- [ ] Feedback widget functional
- [ ] Related articles algorithm tested

### Launch Day

- [ ] Deploy to production
- [ ] Submit sitemap to Google Search Console
- [ ] Submit sitemap to Bing Webmaster Tools
- [ ] Test all links (internal and external)
- [ ] Verify OG images rendering correctly
- [ ] Check analytics tracking
- [ ] Monitor error logs
- [ ] Announce launch (social media, email)

### Post-Launch (Week 1)

- [ ] Monitor Google Search Console for indexing
- [ ] Check for crawl errors
- [ ] Verify analytics data collection
- [ ] Review feedback widget responses
- [ ] Monitor performance metrics
- [ ] Gather user feedback
- [ ] Fix any reported bugs

### Post-Launch (Month 1)

- [ ] Analyze top-performing articles
- [ ] Identify low-performing articles for optimization
- [ ] Review search queries (Google Search Console)
- [ ] Add new articles based on search demand
- [ ] Update metadata for better CTR
- [ ] Build backlinks to top articles
- [ ] Create content promotion plan

---

## Next Steps

1. **Review & Approve Plan:** Confirm implementation approach
2. **Install Dependencies:** Add required npm packages
3. **Create Directory Structure:** Set up folders and files
4. **Build Core Utilities:** Markdown processing, article parsing
5. **Implement Phase 1:** Core infrastructure
6. **Iterate:** Build features incrementally, test thoroughly

---

**Ready to proceed?** Let me know and I'll start implementing Phase 1.
