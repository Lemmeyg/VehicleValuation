import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  /* config options here */
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
