import { resolveVehicleGuideSlug } from '@/lib/personalization/vehicle-year-article'
import { PILLAR_ARTICLE_SLUG } from '@/lib/personalization/kb-article-url'

const FIXED_NOW = new Date('2026-07-29T00:00:00Z') // current_year = 2026 for every case below

describe('resolveVehicleGuideSlug', () => {
  it('returns the leased-vehicle article for a New vehicle (age <= 2)', () => {
    expect(resolveVehicleGuideSlug(2024, FIXED_NOW)).toBe('leased-vehicle-total-loss-what-happens')
  })

  it('treats the current model year as New (age 0)', () => {
    expect(resolveVehicleGuideSlug(2026, FIXED_NOW)).toBe('leased-vehicle-total-loss-what-happens')
  })

  it('returns the financed-vehicle article for a Newer vehicle (age 3-5)', () => {
    expect(resolveVehicleGuideSlug(2022, FIXED_NOW)).toBe(
      'financed-vehicle-total-loss-loan-payoff-negative-equity'
    )
  })

  it('returns the repair-vs-total-loss article for a Mid-age vehicle (age 6-9)', () => {
    expect(resolveVehicleGuideSlug(2018, FIXED_NOW)).toBe('total-loss-or-repair-how-to-decide')
  })

  it('returns the buy-back article for an Older vehicle (age >= 10)', () => {
    expect(resolveVehicleGuideSlug(2010, FIXED_NOW)).toBe(
      'should-you-buy-back-your-totaled-car-hidden-costs'
    )
  })

  it('falls back to the pillar article when vehicle_year is null', () => {
    expect(resolveVehicleGuideSlug(null, FIXED_NOW)).toBe(PILLAR_ARTICLE_SLUG)
  })

  it('defaults `now` to the real current date when not passed', () => {
    // Sanity check only — confirms the default-parameter wiring, not a specific bucket.
    expect(typeof resolveVehicleGuideSlug(2015)).toBe('string')
  })
})
