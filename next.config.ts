import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  /* config options here */
  // PostHog reverse proxy: browser requests to posthog.com domains are silently dropped
  // by mainstream ad blockers (uBlock Origin, Brave, Firefox tracking protection all
  // block that domain by name) -- confirmed happening on this site's live pages
  // (2026-09-29 measurement: config/flags/exception-tracking requests all blocked,
  // page rendered normally with no visible error). Proxying through our own domain
  // makes the traffic same-origin, so a domain-based blocklist has nothing to match.
  // Server-side calls (lib/analytics/server-events.ts) are NOT proxied -- ad blockers
  // only intercept browser requests, and a relative /ingest path has no meaning to
  // Node's server-side fetch.
  async rewrites() {
    return [
      {
        source: '/ingest/static/:path*',
        destination: 'https://us-assets.i.posthog.com/static/:path*',
      },
      {
        source: '/ingest/decide',
        destination: 'https://us.i.posthog.com/decide',
      },
      {
        source: '/ingest/:path*',
        destination: 'https://us.i.posthog.com/:path*',
      },
    ]
  },
  // Required alongside the /ingest rewrites above -- PostHog's own setup docs flag this.
  skipTrailingSlashRedirect: true,
  async redirects() {
    return [
      // KB consolidation (2026-09-28): the two overlapping appraisal articles were merged into
      // the independent-appraisal guide and unpublished. Permanent so search engines move
      // their ranking signals to the surviving page.
      {
        source: '/knowledge-base/right-to-appraisal-auto-insurance-explained',
        destination: '/knowledge-base/total-loss-settlement-too-low-independent-appraisal-guide',
        permanent: true,
      },
      {
        source: '/knowledge-base/appraisal-clause-secret-weapon-settlement-standoff',
        destination: '/knowledge-base/total-loss-settlement-too-low-independent-appraisal-guide',
        permanent: true,
      },
    ]
  },
  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ]
  },
}

export default nextConfig
