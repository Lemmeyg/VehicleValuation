# CRIT-02 — Homepage Metadata Design

**Date:** 2026-03-08
**Branch:** feat/crit-02-homepage-metadata

---

## Problem

`app/layout.tsx` is missing `metadataBase`, Open Graph tags, and the meta description is 138 characters — just below the 140–160 SEO target. This causes build warnings and means social shares show no preview image or optimised title.

---

## Fix

Single change to `app/layout.tsx` — update the `metadata` export:

```ts
metadataBase: new URL('https://www.totallosstoolkit.com'),
title: 'Total Loss Toolkit — Independent Vehicle Valuation Reports',
description: 'Get independent, data-backed vehicle valuations for total loss claims. Professional reports with real market comparables to help you negotiate a fair insurance settlement.',
openGraph: {
  title: 'Total Loss Toolkit — Independent Vehicle Valuation Reports',
  description: 'Get independent, data-backed vehicle valuations for total loss claims. Professional reports with real market comparables to help you negotiate a fair insurance settlement.',
  images: ['/opengraph-image'],
  url: 'https://www.totallosstoolkit.com',
  type: 'website',
},
```

**Description:** 158 characters — within target. Includes "total loss" and clear value prop.
**OG image:** resolves to existing `app/opengraph-image.tsx` (1200×630 PNG).

---

## Out of Scope

- No changes to `app/opengraph-image.tsx`
- No page-level metadata overrides
