/**
 * Tests for the Guarantee page visual upgrade
 */

import { render, screen } from '@testing-library/react'
import MoneyBackGuaranteePage from '@/app/guarantee/page'

// Mock Next.js navigation (used by Navbar)
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => '/guarantee',
}))

describe('Guarantee page', () => {
  it('renders the green guarantee banner with core promise', () => {
    render(<MoneyBackGuaranteePage />)
    expect(screen.getByText(/if your settlement doesn't increase/i)).toBeInTheDocument()
  })

  it('renders the At a Glance summary card', () => {
    render(<MoneyBackGuaranteePage />)
    expect(screen.getByText(/at a glance/i)).toBeInTheDocument()
  })

  it('renders a CTA link pointing to the homepage hero form', () => {
    render(<MoneyBackGuaranteePage />)
    const cta = screen.getByRole('link', { name: /get your report/i })
    expect(cta).toHaveAttribute('href', '/#hero-form')
  })
})
