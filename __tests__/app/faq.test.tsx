/**
 * Tests for the FAQ page
 */

import { render, screen } from '@testing-library/react'
import FAQPage from '@/app/faq/page'

// Mock Next.js navigation (used by Navbar)
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => '/faq',
}))

describe('FAQ page', () => {
  it('renders the page heading', () => {
    render(<FAQPage />)
    expect(
      screen.getByRole('heading', { name: /frequently asked questions/i, level: 1 })
    ).toBeInTheDocument()
  })

  it('explains the 10 comparable listings cap and its guarantee limits', () => {
    render(<FAQPage />)
    expect(
      screen.getByRole('heading', { name: /how many comparable vehicles does my report include/i })
    ).toBeInTheDocument()
    expect(
      screen.getByText(/we guarantee all 10 for vehicles under 15 years old/i)
    ).toBeInTheDocument()
    expect(
      screen.getByText(/driven well above average mileage, there may not be 10/i)
    ).toBeInTheDocument()
  })
})
