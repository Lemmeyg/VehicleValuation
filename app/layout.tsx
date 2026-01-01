import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Toaster } from 'sonner'
import { PostHogProvider } from './providers/posthog-provider'
import { PostHogPageView } from './providers/posthog-pageview'
import { Suspense } from 'react'
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
  title: 'Vehicle Valuation Authority - Independent Market Valuations',
  description:
    'Get independent, data-backed vehicle valuations. Professional reports for total loss claims, diminished value, and insurance negotiations.',
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
          {children}
          <Toaster position="top-right" richColors closeButton />
        </PostHogProvider>
      </body>
    </html>
  )
}
