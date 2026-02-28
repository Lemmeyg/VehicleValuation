/**
 * Tests for ArticleCTA component
 *
 * Verifies the post-article CTA block renders correctly and fires
 * the kb_article_cta_clicked PostHog event on click.
 */

import { render, screen, fireEvent } from '@testing-library/react'
import posthog from 'posthog-js'
import { ArticleCTA } from '@/components/ArticleCTA'

jest.mock('posthog-js', () => ({
  __loaded: true,
  capture: jest.fn(),
}))

const mockPosthog = posthog as jest.Mocked<typeof posthog>

describe('ArticleCTA', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders a headline prompting the user to challenge their insurer', () => {
    render(<ArticleCTA articleSlug="test-article" />)
    expect(screen.getByRole('heading')).toBeInTheDocument()
  })

  it('renders a link to the homepage hero form', () => {
    render(<ArticleCTA articleSlug="test-article" />)
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/#hero-form')
  })

  it('fires kb_article_cta_clicked with the article slug when the CTA is clicked', () => {
    render(<ArticleCTA articleSlug="how-to-challenge-comps" />)
    fireEvent.click(screen.getByRole('link'))
    expect(mockPosthog.capture).toHaveBeenCalledWith(
      'kb_article_cta_clicked',
      expect.objectContaining({
        article_slug: 'how-to-challenge-comps',
      })
    )
  })
})
