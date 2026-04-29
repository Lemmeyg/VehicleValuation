import { render, screen } from '@testing-library/react'
import { RelatedArticlesSidebar } from '@/components/RelatedArticlesSidebar'

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

jest.mock('@/components/RelatedArticleLink', () => ({
  RelatedArticleLink: ({ article }: { article: { title: string } }) => (
    <div data-testid="related-link">{article.title}</div>
  ),
}))

const categories = [
  { name: 'Insurance Claims', count: 14 },
  { name: 'Vehicle Valuation', count: 10 },
  { name: 'State Guides', count: 6 },
]

const relatedArticles = [
  {
    slug: 'other-1',
    title: 'Other Article 1',
    category: 'Vehicle Valuation',
    readingTime: '5 min read',
  },
]

describe('RelatedArticlesSidebar', () => {
  it('renders the Browse Topics heading', () => {
    render(
      <RelatedArticlesSidebar
        relatedArticles={relatedArticles}
        currentSlug="current-article"
        categories={categories}
        currentCategory="Insurance Claims"
      />
    )
    expect(screen.getByText('Browse Topics')).toBeInTheDocument()
  })

  it('renders a link for each category', () => {
    render(
      <RelatedArticlesSidebar
        relatedArticles={relatedArticles}
        currentSlug="current-article"
        categories={categories}
        currentCategory="Insurance Claims"
      />
    )
    expect(screen.getByRole('link', { name: /Insurance Claims/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Vehicle Valuation/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /State Guides/ })).toBeInTheDocument()
  })

  it('highlights the current category with bg-primary-50', () => {
    render(
      <RelatedArticlesSidebar
        relatedArticles={relatedArticles}
        currentSlug="current-article"
        categories={categories}
        currentCategory="Insurance Claims"
      />
    )
    const link = screen.getByRole('link', { name: /Insurance Claims/ })
    expect(link.className).toContain('bg-primary-50')
  })

  it('each category links to /knowledge-base?category=<name>', () => {
    render(
      <RelatedArticlesSidebar
        relatedArticles={relatedArticles}
        currentSlug="current-article"
        categories={categories}
        currentCategory="Insurance Claims"
      />
    )
    expect(screen.getByRole('link', { name: /Vehicle Valuation/ })).toHaveAttribute(
      'href',
      '/knowledge-base?category=Vehicle%20Valuation'
    )
  })

  it('shows article counts next to category names', () => {
    render(
      <RelatedArticlesSidebar
        relatedArticles={relatedArticles}
        currentSlug="current-article"
        categories={categories}
        currentCategory="Insurance Claims"
      />
    )
    expect(screen.getByText('14')).toBeInTheDocument()
    expect(screen.getByText('10')).toBeInTheDocument()
  })

  it('renders the All Articles link pointing to /knowledge-base', () => {
    render(
      <RelatedArticlesSidebar
        relatedArticles={relatedArticles}
        currentSlug="current-article"
        categories={categories}
        currentCategory="Insurance Claims"
      />
    )
    expect(screen.getByRole('link', { name: /All Articles/ })).toHaveAttribute(
      'href',
      '/knowledge-base'
    )
  })

  it('renders existing related articles below Browse Topics', () => {
    render(
      <RelatedArticlesSidebar
        relatedArticles={relatedArticles}
        currentSlug="current-article"
        categories={categories}
        currentCategory="Insurance Claims"
      />
    )
    expect(screen.getByText('Related Articles')).toBeInTheDocument()
    expect(screen.getByTestId('related-link')).toBeInTheDocument()
  })

  it('does not render the Related Articles section when relatedArticles is empty', () => {
    render(
      <RelatedArticlesSidebar
        relatedArticles={[]}
        currentSlug="current-article"
        categories={categories}
        currentCategory="Insurance Claims"
      />
    )
    expect(screen.queryByText('Related Articles')).not.toBeInTheDocument()
  })
})
