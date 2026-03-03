import { render } from '@testing-library/react'
import { ArticlePageTracker } from '@/components/ArticlePageTracker'

jest.mock('@/lib/analytics/events', () => ({
  trackArticleView: jest.fn(),
}))

const mockSetKBAttribution = jest.fn()
jest.mock('@/lib/analytics/kb-attribution', () => ({
  setKBAttribution: (...args: unknown[]) => mockSetKBAttribution(...args),
}))

describe('ArticlePageTracker', () => {
  beforeEach(() => {
    mockSetKBAttribution.mockClear()
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
})
