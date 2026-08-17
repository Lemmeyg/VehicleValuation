import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Toaster } from 'sonner'
import { PostHogProvider } from './providers/posthog-provider'
import { CheckoutReturnTracker } from '@/components/CheckoutReturnTracker'
import { PostHogPageView } from './providers/posthog-pageview'
import { Suspense } from 'react'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  metadataBase: new URL('https://www.totallosstoolkit.com'),
  title: 'Instant Vehicle Valuation Reports',
  description:
    'Instant, data-backed vehicle valuation reports for total loss claims. Real market comparables to help you negotiate a fair insurance settlement.',
  openGraph: {
    title: 'Instant Vehicle Valuation Reports',
    description:
      'Instant, data-backed vehicle valuation reports for total loss claims. Real market comparables to help you negotiate a fair insurance settlement.',
    images: ['/opengraph-image'],
    url: 'https://www.totallosstoolkit.com',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <PostHogProvider>
          <Suspense fallback={null}>
            <PostHogPageView />
          </Suspense>
          <CheckoutReturnTracker />
          {children}
          <Toaster position="top-right" richColors closeButton />
        </PostHogProvider>
        <Analytics />
      </body>
    </html>
  )
}
