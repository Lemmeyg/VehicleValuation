import { PILLAR_ARTICLE_SLUG } from './kb-article-url'

export function resolveVehicleGuideSlug(
  vehicleYear: number | null,
  now: Date = new Date()
): string {
  if (!vehicleYear) return PILLAR_ARTICLE_SLUG

  const age = now.getFullYear() - vehicleYear

  if (age <= 2) return 'leased-vehicle-total-loss-what-happens'
  if (age <= 5) return 'financed-vehicle-total-loss-loan-payoff-negative-equity'
  if (age <= 9) return 'total-loss-or-repair-how-to-decide'
  return 'should-you-buy-back-your-totaled-car-hidden-costs'
}
