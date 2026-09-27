jest.mock('@/lib/analytics/reddit-events', () => ({ trackRedditPurchase: jest.fn() }))

import { render } from '@testing-library/react'
import { RedditPurchaseTracker } from '@/app/reports/[id]/view/RedditPurchaseTracker'
import { trackRedditPurchase } from '@/lib/analytics/reddit-events'

describe('RedditPurchaseTracker (moved to /view)', () => {
  it('fires trackRedditPurchase once on mount with the given props', () => {
    render(<RedditPurchaseTracker value={29} currency="USD" transactionId="txn-1" />)
    expect(trackRedditPurchase).toHaveBeenCalledWith({
      value: 29,
      currency: 'USD',
      transactionId: 'txn-1',
      itemCount: 1,
    })
    expect(trackRedditPurchase).toHaveBeenCalledTimes(1)
  })
})
