/**
 * US state adjacency, used to rank comparable vehicle listings by how close their
 * dealer's state is to the subject vehicle's state.
 */

export const US_STATE_ADJACENCY: Record<string, string[]> = {
  AL: ['GA', 'FL', 'MS', 'TN'],
  AK: [],
  AZ: ['CA', 'NV', 'UT', 'NM'],
  AR: ['MO', 'TN', 'MS', 'LA', 'TX', 'OK'],
  CA: ['OR', 'NV', 'AZ'],
  CO: ['WY', 'NE', 'KS', 'OK', 'NM', 'UT'],
  CT: ['NY', 'MA', 'RI'],
  DE: ['MD', 'PA', 'NJ'],
  FL: ['GA', 'AL'],
  GA: ['FL', 'AL', 'TN', 'NC', 'SC'],
  HI: [],
  ID: ['MT', 'WY', 'UT', 'NV', 'OR', 'WA'],
  IL: ['IN', 'KY', 'MO', 'IA', 'WI'],
  IN: ['MI', 'OH', 'KY', 'IL'],
  IA: ['MN', 'WI', 'IL', 'MO', 'NE', 'SD'],
  KS: ['NE', 'MO', 'OK', 'CO'],
  KY: ['IN', 'OH', 'WV', 'VA', 'TN', 'MO', 'IL'],
  LA: ['TX', 'AR', 'MS'],
  ME: ['NH'],
  MD: ['VA', 'WV', 'PA', 'DE', 'DC'],
  MA: ['RI', 'CT', 'NY', 'NH', 'VT'],
  MI: ['OH', 'IN', 'WI'],
  MN: ['WI', 'IA', 'SD', 'ND'],
  MS: ['LA', 'AR', 'TN', 'AL'],
  MO: ['IA', 'IL', 'KY', 'TN', 'AR', 'OK', 'KS', 'NE'],
  MT: ['ND', 'SD', 'WY', 'ID'],
  NE: ['SD', 'IA', 'MO', 'KS', 'CO', 'WY'],
  NV: ['OR', 'ID', 'UT', 'AZ', 'CA'],
  NH: ['ME', 'MA', 'VT'],
  NJ: ['NY', 'PA', 'DE'],
  NM: ['AZ', 'UT', 'CO', 'OK', 'TX'],
  NY: ['NJ', 'PA', 'CT', 'MA', 'VT'],
  NC: ['VA', 'TN', 'GA', 'SC'],
  ND: ['MN', 'SD', 'MT'],
  OH: ['MI', 'PA', 'WV', 'KY', 'IN'],
  OK: ['KS', 'MO', 'AR', 'TX', 'NM', 'CO'],
  OR: ['WA', 'ID', 'NV', 'CA'],
  PA: ['NY', 'NJ', 'DE', 'MD', 'WV', 'OH'],
  RI: ['CT', 'MA'],
  SC: ['NC', 'GA'],
  SD: ['ND', 'MN', 'IA', 'NE', 'WY', 'MT'],
  TN: ['KY', 'VA', 'NC', 'GA', 'AL', 'MS', 'AR', 'MO'],
  TX: ['NM', 'OK', 'AR', 'LA'],
  UT: ['ID', 'WY', 'CO', 'NM', 'AZ', 'NV'],
  VT: ['NY', 'NH', 'MA'],
  VA: ['NC', 'TN', 'KY', 'WV', 'MD', 'DC'],
  WA: ['ID', 'OR'],
  WV: ['OH', 'PA', 'MD', 'VA', 'KY'],
  WI: ['MI', 'MN', 'IA', 'IL'],
  WY: ['MT', 'SD', 'NE', 'CO', 'UT', 'ID'],
  DC: ['MD', 'VA'],
}

/**
 * How close a listing's state is to the subject's state, for ranking purposes:
 *   0 = same state
 *   1 = a bordering state
 *   2 = anything else, or either state is unknown
 */
export function locationTier(subjectState: string | null, listingState: string | null): 0 | 1 | 2 {
  if (!subjectState || !listingState) return 2

  const subject = subjectState.toUpperCase()
  const listing = listingState.toUpperCase()

  if (subject === listing) return 0
  if (US_STATE_ADJACENCY[subject]?.includes(listing)) return 1
  return 2
}
