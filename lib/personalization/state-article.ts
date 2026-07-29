import { PILLAR_ARTICLE_SLUG } from './kb-article-url'

interface StateArticleEntry {
  name: string
  slug: string
}

const STATE_ARTICLES: Record<string, StateArticleEntry> = {
  AL: { name: 'Alabama', slug: 'alabama-total-loss-law-explained' },
  AK: { name: 'Alaska', slug: 'alaska-total-loss-law-explained' },
  AZ: { name: 'Arizona', slug: 'arizona-total-loss-law-explained' },
  AR: { name: 'Arkansas', slug: 'arkansas-total-loss-law-explained' },
  CA: { name: 'California', slug: 'california-total-loss-law-explained' },
  CO: { name: 'Colorado', slug: 'colorado-total-loss-law-explained' },
  CT: { name: 'Connecticut', slug: 'connecticut-total-loss-law-explained' },
  DE: { name: 'Delaware', slug: 'delaware-total-loss-law-explained' },
  FL: { name: 'Florida', slug: 'florida-total-loss-state-law-explained' },
  GA: { name: 'Georgia', slug: 'georgia-total-loss-law-explained' },
  HI: { name: 'Hawaii', slug: 'hawaii-total-loss-law-explained' },
  ID: { name: 'Idaho', slug: 'idaho-total-loss-law-explained' },
  IL: { name: 'Illinois', slug: 'illinois-total-loss-law-explained' },
  IN: { name: 'Indiana', slug: 'indiana-total-loss-law-explained' },
  IA: { name: 'Iowa', slug: 'iowa-total-loss-law-explained' },
  KS: { name: 'Kansas', slug: 'kansas-total-loss-law-explained' },
  KY: { name: 'Kentucky', slug: 'kentucky-total-loss-law-explained' },
  LA: { name: 'Louisiana', slug: 'louisiana-total-loss-law-explained' },
  ME: { name: 'Maine', slug: 'maine-total-loss-law-explained' },
  MD: { name: 'Maryland', slug: 'maryland-total-loss-state-rules-explained' },
  MA: { name: 'Massachusetts', slug: 'massachusetts-total-loss-law-explained' },
  MI: { name: 'Michigan', slug: 'michigan-total-loss-law-explained' },
  MN: { name: 'Minnesota', slug: 'minnesota-total-loss-law-explained' },
  MS: { name: 'Mississippi', slug: 'mississippi-total-loss-law-explained' },
  MO: { name: 'Missouri', slug: 'missouri-total-loss-law-explained' },
  MT: { name: 'Montana', slug: 'montana-total-loss-law-explained' },
  NE: { name: 'Nebraska', slug: 'nebraska-total-loss-law-explained' },
  NV: { name: 'Nevada', slug: 'nevada-total-loss-law-explained' },
  NH: { name: 'New Hampshire', slug: 'new-hampshire-total-loss-law-explained' },
  NJ: { name: 'New Jersey', slug: 'new-jersey-total-loss-law-explained' },
  NM: { name: 'New Mexico', slug: 'new-mexico-total-loss-law-explained' },
  NY: { name: 'New York', slug: 'new-york-total-loss-law-explained' },
  NC: { name: 'North Carolina', slug: 'north-carolina-total-loss-law-explained' },
  ND: { name: 'North Dakota', slug: 'north-dakota-total-loss-law-explained' },
  OH: { name: 'Ohio', slug: 'ohio-total-loss-law-explained' },
  OK: { name: 'Oklahoma', slug: 'oklahoma-total-loss-law-explained' },
  OR: { name: 'Oregon', slug: 'oregon-total-loss-law-explained' },
  PA: { name: 'Pennsylvania', slug: 'pennsylvania-total-loss-law-explained' },
  RI: { name: 'Rhode Island', slug: 'rhode-island-total-loss-law-explained' },
  SC: { name: 'South Carolina', slug: 'south-carolina-total-loss-law-explained' },
  SD: { name: 'South Dakota', slug: 'south-dakota-total-loss-law-explained' },
  TN: { name: 'Tennessee', slug: 'tennessee-total-loss-law-explained' },
  TX: { name: 'Texas', slug: 'texas-total-loss-law-explained' },
  UT: { name: 'Utah', slug: 'utah-total-loss-law-explained' },
  VT: { name: 'Vermont', slug: 'vermont-total-loss-law-explained' },
  VA: { name: 'Virginia', slug: 'virginia-total-loss-law-explained' },
  WA: { name: 'Washington', slug: 'washington-total-loss-law-explained' },
  WV: { name: 'West Virginia', slug: 'west-virginia-total-loss-law-explained' },
  WI: { name: 'Wisconsin', slug: 'wisconsin-total-loss-law-explained' },
  WY: { name: 'Wyoming', slug: 'wyoming-total-loss-law-explained' },
}

export function resolveStateArticle(stateCode: string | null): { stateName: string; slug: string } {
  const entry = stateCode ? STATE_ARTICLES[stateCode] : undefined
  if (!entry) return { stateName: 'your state', slug: PILLAR_ARTICLE_SLUG }
  return { stateName: entry.name, slug: entry.slug }
}
