import { render, screen } from '@testing-library/react'
import { MarketingConsentNotice } from '@/components/MarketingConsentNotice'

describe('MarketingConsentNotice', () => {
  it('renders the consent copy with a link to the privacy policy', () => {
    render(<MarketingConsentNotice />)
    expect(screen.getByText(/unsubscribe at any time/i)).toBeInTheDocument()
    const link = screen.getByRole('link', { name: /privacy policy/i })
    expect(link).toHaveAttribute('href', '/privacy')
  })

  it('defaults to the light variant color', () => {
    const { container } = render(<MarketingConsentNotice />)
    expect(container.querySelector('p')).toHaveClass('text-slate-500')
  })

  it('applies the dark variant color when variant="dark"', () => {
    const { container } = render(<MarketingConsentNotice variant="dark" />)
    expect(container.querySelector('p')).toHaveClass('text-white/55')
  })

  it('merges an additional className onto the root element', () => {
    const { container } = render(<MarketingConsentNotice className="mt-4" />)
    expect(container.querySelector('p')).toHaveClass('mt-4')
  })
})
