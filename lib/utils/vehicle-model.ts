/**
 * MarketCheck's for-sale inventory indexes a vehicle by its canonical model
 * ("Civic") with the body style in a separate `body_type` filter. The auto.dev
 * VIN decoder returns "Civic Coupe" as one string, and the decoder's own body
 * field is too coarse ("Car"). Recover the body style from the trailing token
 * on `model` and hand it back separately so the fallback search can send
 * `model=Civic&body_type=Coupe` — a 2017 Civic Coupe must be valued against
 * other coupes, not against a sedan-dominated bare-model result set.
 *
 * Do NOT first-word-truncate — that breaks "Grand Highlander", "Santa Fe
 * Sport", "Wrangler Unlimited", "Model S", "Prius c", "IONIQ 5".
 *
 * Only trailing tokens with a confirmed MarketCheck `body_type` value are
 * split; an unmapped trailing token (wagon / van / minivan) is left on the
 * model string untouched.
 *
 * body_type values: SUV, Pickup, Sedan, Hatchback, Convertible are documented
 * examples on the MarketCheck Inventory Search endpoint
 * (https://docs.marketcheck.com/docs/api/cars/inventory/inventory-search).
 * Coupe is used per the PR #141 Preview probe (handoff §2). // TODO verify Coupe
 * against an exhaustive body_type list if MarketCheck ever publishes one.
 */
const BODY_TYPE_MAP: Record<string, string> = {
  coupe: 'Coupe',
  sedan: 'Sedan',
  hatchback: 'Hatchback',
  convertible: 'Convertible',
  cabriolet: 'Convertible',
  'crew cab': 'Pickup',
  'extended cab': 'Pickup',
  'regular cab': 'Pickup',
  pickup: 'Pickup',
  suv: 'SUV',
  // 'wagon' / 'van' / 'minivan' — no confirmed body_type value; left on the model string
}

export function splitModelAndBodyType(model: string): { model: string; bodyType?: string } {
  const trimmed = (model || '').trim()
  const lower = trimmed.toLowerCase()

  for (const [token, bodyType] of Object.entries(BODY_TYPE_MAP)) {
    if (lower.endsWith(' ' + token)) {
      const base = trimmed.slice(0, trimmed.length - token.length - 1).trim()
      // Never strip the model down to nothing (e.g. a model literally named "Coupe").
      if (base.length > 0) {
        return { model: base, bodyType }
      }
    }
  }

  return { model: trimmed }
}
