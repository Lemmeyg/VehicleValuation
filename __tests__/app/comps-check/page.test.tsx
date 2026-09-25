import { render, screen } from '@testing-library/react'
import CompsCheckPage, { metadata } from '@/app/comps-check/page'

// Mock Next.js navigation (used by Navbar)
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => '/comps-check',
}))

jest.mock('@/components/CompsCheckForm', () => {
  return function MockCompsCheckForm() {
    return <div data-testid="comps-check-form" />
  }
})

jest.mock('@/components/Navbar', () => {
  return function MockNavbar() {
    return <div data-testid="navbar" />
  }
})

jest.mock('@/components/Footer', () => {
  return function MockFooter() {
    return <div data-testid="footer" />
  }
})

describe('/comps-check metadata', () => {
  it('sets robots to noindex, nofollow', () => {
    expect(metadata.robots).toEqual({ index: false, follow: false })
  })
})

describe('CompsCheckPage', () => {
  it('renders the beta label, heading, and the form', () => {
    render(<CompsCheckPage />)
    expect(screen.getByText(/beta/i)).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
    expect(screen.getByTestId('comps-check-form')).toBeInTheDocument()
  })
})
