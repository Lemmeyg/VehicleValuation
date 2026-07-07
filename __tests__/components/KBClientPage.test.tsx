import { render, screen, fireEvent } from '@testing-library/react'
import { KBClientPage } from '@/components/KBClientPage'
import type { ArticleListItem } from '@/lib/knowledge-base-db'

jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ replace: jest.fn() }),
}))

jest.mock('@/components/KnowledgeBaseTracker', () => ({
  KnowledgeBasePageTracker: () => null,
  ArticleLinkTracker: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

jest.mock(
  'next/link',
  () =>
    function MockLink({
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
)

function makeArticle(overrides: Partial<ArticleListItem>): ArticleListItem {
  return {
    slug: 'default-slug',
    title: 'Default Title',
    description: 'Default description',
    category: 'Insurance Claims',
    tags: [],
    author: 'Test Author',
    datePublished: '2025-01-01',
    dateModified: '2025-01-01',
    featured: false,
    published: true,
    readingTime: '5 min read',
    ...overrides,
  }
}

const articles: ArticleListItem[] = [
  makeArticle({
    slug: 'article-a',
    title: 'Fight Your Insurer',
    category: 'Insurance Claims',
    tags: ['dispute'],
  }),
  makeArticle({
    slug: 'article-b',
    title: 'State Law Guide',
    category: 'State Guides',
    tags: ['law'],
  }),
  makeArticle({
    slug: 'article-c',
    title: 'Valuation Tips',
    category: 'Vehicle Valuation',
    tags: ['valuation'],
  }),
]

const categories = ['Insurance Claims', 'State Guides', 'Vehicle Valuation']

describe('KBClientPage', () => {
  it('renders all articles when no filter is active', () => {
    render(<KBClientPage articles={articles} categories={categories} totalCount={3} />)
    expect(screen.getByText('Fight Your Insurer')).toBeInTheDocument()
    expect(screen.getByText('State Law Guide')).toBeInTheDocument()
    expect(screen.getByText('Valuation Tips')).toBeInTheDocument()
  })

  it('filters articles by category when a category pill is clicked', () => {
    render(<KBClientPage articles={articles} categories={categories} totalCount={3} />)
    fireEvent.click(screen.getByRole('button', { name: 'State Guides' }))
    expect(screen.queryByText('Fight Your Insurer')).not.toBeInTheDocument()
    expect(screen.getByText('State Law Guide')).toBeInTheDocument()
    expect(screen.queryByText('Valuation Tips')).not.toBeInTheDocument()
  })

  it('filters articles by search query matching title', () => {
    render(<KBClientPage articles={articles} categories={categories} totalCount={3} />)
    fireEvent.change(screen.getByPlaceholderText('Search articles…'), {
      target: { value: 'valuation' },
    })
    fireEvent.submit(screen.getByRole('button', { name: 'Search' }).closest('form')!)
    expect(screen.queryByText('Fight Your Insurer')).not.toBeInTheDocument()
    expect(screen.getByText('Valuation Tips')).toBeInTheDocument()
  })

  it('filters articles by search query matching description', () => {
    render(
      <KBClientPage
        articles={[
          makeArticle({ slug: 's', title: 'Something', description: 'About dispute letters' }),
        ]}
        categories={[]}
        totalCount={1}
      />
    )
    fireEvent.change(screen.getByPlaceholderText('Search articles…'), {
      target: { value: 'dispute' },
    })
    fireEvent.submit(screen.getByRole('button', { name: 'Search' }).closest('form')!)
    expect(screen.getByText('Something')).toBeInTheDocument()
  })

  it('shows "No articles found" when no articles match', () => {
    render(<KBClientPage articles={articles} categories={categories} totalCount={3} />)
    fireEvent.change(screen.getByPlaceholderText('Search articles…'), {
      target: { value: 'zzznomatch' },
    })
    fireEvent.submit(screen.getByRole('button', { name: 'Search' }).closest('form')!)
    expect(screen.getByText('No articles found.')).toBeInTheDocument()
  })

  it('shows filtered count when a filter is active', () => {
    render(<KBClientPage articles={articles} categories={categories} totalCount={3} />)
    fireEvent.click(screen.getByRole('button', { name: 'State Guides' }))
    expect(screen.getByText(/Showing 1 of 3 articles/)).toBeInTheDocument()
  })

  it('shows total count when no filter is active', () => {
    render(<KBClientPage articles={articles} categories={categories} totalCount={3} />)
    expect(screen.getByText(/Showing 3 articles/)).toBeInTheDocument()
  })

  it('clears an active category filter when a search is submitted', () => {
    render(<KBClientPage articles={articles} categories={categories} totalCount={3} />)

    // Select "State Guides" category — narrows to article-b only.
    fireEvent.click(screen.getByRole('button', { name: 'State Guides' }))
    expect(screen.queryByText('Valuation Tips')).not.toBeInTheDocument()

    // Search for a term that only matches an article in a DIFFERENT category.
    fireEvent.change(screen.getByPlaceholderText('Search articles…'), {
      target: { value: 'valuation' },
    })
    fireEvent.submit(screen.getByRole('button', { name: 'Search' }).closest('form')!)

    // The stale category filter should no longer suppress it.
    expect(screen.getByText('Valuation Tips')).toBeInTheDocument()
    expect(screen.queryByText('State Law Guide')).not.toBeInTheDocument()

    // The "All" category pill should be active again.
    expect(screen.getByRole('button', { name: 'All' })).toHaveClass('bg-primary-600')
  })
})
