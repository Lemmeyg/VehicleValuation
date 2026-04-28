import { render, screen } from '@testing-library/react'
import { KBFilterBar } from '@/components/KBFilterBar'

jest.mock('next/link', () => {
  return function MockLink({
    href,
    children,
    className,
  }: {
    href: string
    children: React.ReactNode
    className?: string
  }) {
    return (
      <a href={href} className={className}>
        {children}
      </a>
    )
  }
})

const categories = ['Insurance Claims', 'Vehicle Valuation', 'State Guides']

describe('KBFilterBar', () => {
  it('renders the search input', () => {
    render(<KBFilterBar categories={categories} />)
    expect(screen.getByPlaceholderText('Search articles…')).toBeInTheDocument()
  })

  it('renders the Search submit button', () => {
    render(<KBFilterBar categories={categories} />)
    expect(screen.getByRole('button', { name: 'Search' })).toBeInTheDocument()
  })

  it('renders an "All" pill', () => {
    render(<KBFilterBar categories={categories} />)
    expect(screen.getByRole('link', { name: 'All' })).toBeInTheDocument()
  })

  it('renders a pill for each category', () => {
    render(<KBFilterBar categories={categories} />)
    expect(screen.getByRole('link', { name: 'Insurance Claims' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Vehicle Valuation' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'State Guides' })).toBeInTheDocument()
  })

  it('applies the active style to "All" when no activeCategory is set', () => {
    render(<KBFilterBar categories={categories} />)
    expect(screen.getByRole('link', { name: 'All' }).className).toContain('bg-primary-600')
  })

  it('applies the active style to the matching category pill', () => {
    render(<KBFilterBar categories={categories} activeCategory="Insurance Claims" />)
    expect(screen.getByRole('link', { name: 'Insurance Claims' }).className).toContain(
      'bg-primary-600'
    )
  })

  it('category pill href includes the ?category= param', () => {
    render(<KBFilterBar categories={categories} />)
    expect(screen.getByRole('link', { name: 'Insurance Claims' })).toHaveAttribute(
      'href',
      '/knowledge-base?category=Insurance+Claims'
    )
  })

  it('category pill href preserves activeQuery when set', () => {
    render(<KBFilterBar categories={categories} activeQuery="dispute" />)
    const pill = screen.getByRole('link', { name: 'Insurance Claims' })
    expect(pill).toHaveAttribute('href', expect.stringContaining('q=dispute'))
    expect(pill).toHaveAttribute('href', expect.stringContaining('category=Insurance+Claims'))
  })

  it('includes a hidden category input when activeCategory is set', () => {
    render(<KBFilterBar categories={categories} activeCategory="Insurance Claims" />)
    const hidden = document.querySelector(
      'input[type="hidden"][name="category"]'
    ) as HTMLInputElement
    expect(hidden).toBeInTheDocument()
    expect(hidden.value).toBe('Insurance Claims')
  })

  it('search input shows the current activeQuery as its default value', () => {
    render(<KBFilterBar categories={categories} activeQuery="settlement" />)
    const input = screen.getByPlaceholderText('Search articles…') as HTMLInputElement
    expect(input.value).toBe('settlement')
  })
})
