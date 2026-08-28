/**
 * Dealer-Type Supplementer
 *
 * MarketCheck's primary VIN-based prediction endpoint requires a dealer_type
 * on every call and only accepts 'franchise' or 'independent' — there is no
 * "both" value (confirmed against MarketCheck's own docs after a real 400
 * Bad Request in production revealed the app had been silently omitting a
 * required parameter). To surface both dealer types without doubling the
 * cost of every single report, this only fires a second call for the other
 * dealer type when the first call's results came up short — reusing the
 * same "fewer than 10 validated listings" threshold the app already uses
 * elsewhere to decide it needs more data.
 */

import {
  fetchMarketCheckData,
  type MarketCheckPrediction,
  type MarketCheckComparable,
} from '@/lib/api/marketcheck-client'
import { validateListingUrls } from './url-validator'
import { gateListings } from './comp-gates'
import { makeScoreSortFn } from './comp-relevance-score'

const MIN_VALID = 10

export interface DealerTypeSupplementResult {
  prediction: MarketCheckPrediction
  supplemented: boolean
  additionalValidatedUrls: string[]
  additionalFailedUrls: string[]
  additionalFailedCount: number
}

/**
 * If fewer than MIN_VALID (10) listings were confirmed valid from the first
 * MarketCheck call, fires a second primary-endpoint call for the other
 * dealer type and merges its listings in (deduped by VIN). Keeps the first
 * call's own predictedPrice/priceRange/confidence unchanged — MarketCheck's
 * authoritative valuation — this only widens the pool of listings shown.
 */
export async function supplementWithAlternateDealerType(
  prediction: MarketCheckPrediction,
  validatedCount: number,
  vin: string,
  mileage: number,
  zip: string,
  primaryDealerType: 'franchise' | 'independent',
  subjectVehicle?: { year?: number; make?: string; model?: string; trim?: string },
  isCertified: boolean = false
): Promise<DealerTypeSupplementResult> {
  const unchanged: DealerTypeSupplementResult = {
    prediction,
    supplemented: false,
    additionalValidatedUrls: [],
    additionalFailedUrls: [],
    additionalFailedCount: 0,
  }

  if (validatedCount >= MIN_VALID) return unchanged

  const alternateDealerType = primaryDealerType === 'franchise' ? 'independent' : 'franchise'

  const altResult = await fetchMarketCheckData(
    vin,
    mileage,
    zip,
    isCertified,
    undefined,
    subjectVehicle,
    alternateDealerType
  )
  if (!altResult.success || !altResult.data) return unchanged

  const existingVins = new Set(
    (prediction.recentComparables?.listings ?? []).map(l => l.vin).filter((v): v is string => !!v)
  )
  const newListings = (altResult.data.recentComparables?.listings ?? []).filter(
    (l): l is MarketCheckComparable => !!l.vin && !existingVins.has(l.vin)
  )
  if (newListings.length === 0) return unchanged

  // Hard gates (model / price / mileage / ±40% band) BEFORE URL validation so a
  // disqualified comp is never HTTP-checked; check survivors in weighted-score order.
  const gatedNewListings = gateListings(newListings, prediction.predictedPrice)
  // A fully-gated alternate batch contributes nothing — return unchanged rather
  // than report supplemented:true with a totalComparablesFound bump and zero
  // merged listings (mirrors the newListings.length === 0 guard above).
  if (gatedNewListings.length === 0) return unchanged

  const { prediction: validatedAlt, stats: altStats } = await validateListingUrls(
    {
      ...altResult.data,
      recentComparables: {
        num_found: gatedNewListings.length,
        listings: gatedNewListings,
        stats: altResult.data.recentComparables?.stats,
      },
    },
    {
      sortFn: makeScoreSortFn(
        {
          year: subjectVehicle?.year ?? 0,
          mileage,
          zip,
          model: subjectVehicle?.model,
          trim: subjectVehicle?.trim,
        },
        prediction.predictedPrice
      ),
    }
  )

  const mergedListings = [
    ...(prediction.recentComparables?.listings ?? []),
    ...(validatedAlt.recentComparables?.listings ?? newListings),
  ]

  return {
    prediction: {
      ...prediction,
      requestParams: { ...prediction.requestParams, dealer_type: 'both' },
      totalComparablesFound:
        prediction.totalComparablesFound + altResult.data.totalComparablesFound,
      recentComparables: {
        num_found: mergedListings.length,
        listings: mergedListings,
        stats: prediction.recentComparables?.stats,
      },
    },
    supplemented: true,
    additionalValidatedUrls: altStats.validatedUrls,
    additionalFailedUrls: altStats.failedUrls,
    additionalFailedCount: altStats.failedCount,
  }
}
