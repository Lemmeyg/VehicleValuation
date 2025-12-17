'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Button } from './ui/Button'
import { Menu, X, LogOut, LayoutDashboard } from 'lucide-react'

const NAV_ITEMS = [
  { label: 'Vehicle Valuation', href: '#valuation' },
  { label: 'Directory', href: '/directory' },
  { label: 'Knowledge Base', href: '#knowledge-base' },
  { label: 'Pricing', href: '#valuation' },
]

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/session')
        const session = await response.json()
        setIsLoggedIn(!!session?.user)
      } catch {
        setIsLoggedIn(false)
      } finally {
        setLoading(false)
      }
    }
    checkAuth()
  }, [])

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      setIsLoggedIn(false)
      router.push('/')
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    // If it's an anchor link and we're on the homepage
    if (href.startsWith('#')) {
      // Check if we're on homepage
      if (pathname === '/') {
        e.preventDefault()
        const element = document.querySelector(href)
        if (element) {
          const offset = 80 // Account for fixed navbar
          const elementPosition = element.getBoundingClientRect().top + window.pageYOffset
          window.scrollTo({
            top: elementPosition - offset,
            behavior: 'smooth',
          })
        }
      } else {
        // On other pages, navigate to homepage with hash
        window.location.href = '/' + href
      }
      setMobileMenuOpen(false)
    }
  }

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled ? 'glass-navbar border-b border-slate-200 shadow-sm py-3' : 'bg-transparent py-5'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center">
          {/* Logo */}
          <Link href="/" className="flex items-center">
            <span className={`text-2xl font-bold ${isScrolled ? 'text-slate-900' : 'text-white'}`}>
              Vehicle Valuation
            </span>
          </Link>

          {/* Desktop Links */}
          <div className="hidden md:flex items-center space-x-8">
            {NAV_ITEMS.map(item => {
              const isExternal = !item.href.startsWith('#')
              return isExternal ? (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`text-sm font-medium hover:text-primary-500 transition-colors ${
                    isScrolled ? 'text-slate-600' : 'text-slate-200 hover:text-white'
                  }`}
                >
                  {item.label}
                </Link>
              ) : (
                <a
                  key={item.label}
                  href={item.href}
                  onClick={e => handleNavClick(e, item.href)}
                  className={`text-sm font-medium hover:text-primary-500 transition-colors cursor-pointer ${
                    isScrolled ? 'text-slate-600' : 'text-slate-200 hover:text-white'
                  }`}
                >
                  {item.label}
                </a>
              )
            })}
          </div>

          {/* CTA Buttons - Dynamic based on auth */}
          <div className="hidden md:flex items-center space-x-4">
            {!loading && (
              <>
                {isLoggedIn ? (
                  <>
                    <Link
                      href="/dashboard"
                      className={`flex items-center text-sm font-medium ${
                        isScrolled
                          ? 'text-slate-600 hover:text-primary-600'
                          : 'text-white hover:text-primary-200'
                      }`}
                    >
                      <LayoutDashboard className="h-4 w-4 mr-1" />
                      Dashboard
                    </Link>
                    <button
                      onClick={handleLogout}
                      className={`flex items-center text-sm font-medium ${
                        isScrolled
                          ? 'text-slate-600 hover:text-red-600'
                          : 'text-white hover:text-red-200'
                      }`}
                    >
                      <LogOut className="h-4 w-4 mr-1" />
                      Sign Out
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      href="/login"
                      className={`text-sm font-medium ${
                        isScrolled
                          ? 'text-slate-600 hover:text-primary-600'
                          : 'text-white hover:text-primary-200'
                      }`}
                    >
                      Login
                    </Link>
                    <Link href="/signup">
                      <Button variant={isScrolled ? 'primary' : 'glass'} size="sm">
                        Sign Up
                      </Button>
                    </Link>
                  </>
                )}
              </>
            )}
          </div>

          {/* Mobile Toggle */}
          <div className="md:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className={isScrolled ? 'text-slate-900' : 'text-white'}
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden absolute top-full left-0 right-0 bg-white border-b border-slate-200 p-4 shadow-xl">
          <div className="flex flex-col space-y-4">
            {NAV_ITEMS.map(item => {
              const isExternal = !item.href.startsWith('#')
              return isExternal ? (
                <Link
                  key={item.label}
                  href={item.href}
                  className="text-slate-600 font-medium px-2 py-2 rounded hover:bg-slate-50"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {item.label}
                </Link>
              ) : (
                <a
                  key={item.label}
                  href={item.href}
                  onClick={e => handleNavClick(e, item.href)}
                  className="text-slate-600 font-medium px-2 py-2 rounded hover:bg-slate-50 cursor-pointer"
                >
                  {item.label}
                </a>
              )
            })}
            <div className="pt-4 border-t border-slate-100 flex flex-col space-y-3">
              {!loading && (
                <>
                  {isLoggedIn ? (
                    <>
                      <Link href="/dashboard" onClick={() => setMobileMenuOpen(false)}>
                        <Button variant="outline" className="w-full">
                          <LayoutDashboard className="h-4 w-4 mr-2" />
                          Dashboard
                        </Button>
                      </Link>
                      <Button
                        variant="primary"
                        className="w-full"
                        onClick={() => {
                          handleLogout()
                          setMobileMenuOpen(false)
                        }}
                      >
                        <LogOut className="h-4 w-4 mr-2" />
                        Sign Out
                      </Button>
                    </>
                  ) : (
                    <>
                      <Link href="/login" onClick={() => setMobileMenuOpen(false)}>
                        <Button variant="outline" className="w-full">
                          Login
                        </Button>
                      </Link>
                      <Link href="/signup" onClick={() => setMobileMenuOpen(false)}>
                        <Button variant="primary" className="w-full">
                          Sign Up
                        </Button>
                      </Link>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}
