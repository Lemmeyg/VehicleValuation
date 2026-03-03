import { render, act } from '@testing-library/react'
import { ArticlePageTracker } from '@/components/ArticlePageTracker'

const mockTrackArticleView = jest.fn()
const mockTrackEvent = jest.fn()
jest.mock('@/lib/analytics/events', () => ({
  trackArticleView: (...args: unknown[]) => mockTrackArticleView(...args),
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}))

const mockSetKBAttribution = jest.fn()
jest.mock('@/lib/analytics/kb-attribution', () => ({
  setKBAttribution: (...args: unknown[]) => mockSetKBAttribution(...args),
}))

describe('ArticlePageTracker', () => {
  beforeEach(() => {
    mockSetKBAttribution.mockClear()
    mockTrackEvent.mockClear()
    mockTrackArticleView.mockClear()

    // Set up a scrollable page: total height 2000px, viewport 500px
    // scrollable range = 2000 - 500 = 1500px
    Object.defineProperty(document.documentElement, 'scrollHeight', {
      value: 2000,
      configurable: true,
    })
    Object.defineProperty(window, 'innerHeight', {
      value: 500,
      configurable: true,
    })
    Object.defineProperty(window, 'scrollY', {
      value: 0,
      configurable: true,
      writable: true,
    })
  })

  it('calls setKBAttribution with slug and title on mount', () => {
    render(
      <ArticlePageTracker
        slug="challenge-comps"
        title="How to Challenge Comparable Vehicles"
        category="total-loss"
      />
    )

    expect(mockSetKBAttribution).toHaveBeenCalledWith(
      'challenge-comps',
      'How to Challenge Comparable Vehicles'
    )
  })

  it('fires kb_article_scrolled with depth 50 when scrolled to 50%', () => {
    render(<ArticlePageTracker slug="test-article" title="Test" category="total-loss" />)

    act(() => {
      Object.defineProperty(window, 'scrollY', { value: 750, configurable: true })
      window.dispatchEvent(new Event('scroll'))
    })

    expect(mockTrackEvent).toHaveBeenCalledWith('kb_article_scrolled', {
      article_slug: 'test-article',
      depth: 50,
    })
  })

  it('fires kb_article_scrolled with depth 100 when scrolled to bottom', () => {
    render(<ArticlePageTracker slug="test-article" title="Test" category="total-loss" />)

    act(() => {
      Object.defineProperty(window, 'scrollY', { value: 1500, configurable: true })
      window.dispatchEvent(new Event('scroll'))
    })

    expect(mockTrackEvent).toHaveBeenCalledWith('kb_article_scrolled', {
      article_slug: 'test-article',
      depth: 100,
    })
  })

  it('does not fire the same depth milestone twice', () => {
    render(<ArticlePageTracker slug="test-article" title="Test" category="total-loss" />)

    act(() => {
      Object.defineProperty(window, 'scrollY', { value: 750, configurable: true })
      window.dispatchEvent(new Event('scroll'))
      window.dispatchEvent(new Event('scroll'))
    })

    const scrollCalls = mockTrackEvent.mock.calls.filter(
      ([event]) => event === 'kb_article_scrolled'
    )
    expect(scrollCalls).toHaveLength(1)
  })
})
