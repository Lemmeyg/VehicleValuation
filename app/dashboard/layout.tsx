/**
 * Dashboard Layout
 *
 * Protected layout for authenticated users.
 * Includes navigation and user profile display.
 */

import { getUser } from '@/lib/db/auth'
import { redirect } from 'next/navigation'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Use the same Navbar as homepage - always show with glass effect on dashboard */}
      <Navbar alwaysScrolled={true} />

      {/* Main content - Add top padding to account for fixed navbar */}
      <main className="flex-1 pt-24 pb-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">{children}</div>
      </main>

      {/* Use the same Footer as homepage */}
      <Footer />
    </div>
  )
}
