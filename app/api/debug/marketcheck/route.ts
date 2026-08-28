/**
 * THROWAWAY DEBUG ROUTE — DO NOT MERGE TO main.
 *
 * One-off probe to see what MarketCheck returns for a given VIN right now, and whether the
 * URL-validation + supplement pipeline recovers any comparable listings. Mirrors exactly what
 * app/api/lemonsqueezy/webhook/route.ts does after payment, but reads nothing from and writes
 * nothing to the database.
 *
 * Created 2026-08-28 to investigate report 63cf7f1b-0e67-4c60-9907-f7b0c786d747
 * (2017 Honda Civic Coupe, ZIP 14450) which shipped with an empty comparables table.
 *
 * Usage (on the Vercel Preview URL for this branch only):
 *   GET /api/debug/marketcheck?secret=<SECRET>
 *   GET /api/debug/marketcheck?secret=<SECRET>&model=Civic          (override to test name match)
 *   GET /api/debug/marketcheck?secret=<SECRET>&vin=...&miles=...&zip=...&year=...&make=...&model=...&trim=...
 */

import { NextRequest, NextResponse } from 'next/server'
import { fetchMarketCheckData } from '@/lib/api/marketcheck-client'
import { validateListingUrls } from '@/lib/utils/url-validator'
import { supplementComparables } from '@/lib/utils/comparables-supplementer'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const SECRET = 'mc_probe_7Kq2x9Fh4Lm8Rt3Wp6Zn1Bv5Cd0Ys'

// Defaults = report 63cf7f1b
const DEFAULTS = {
  vin: '2HGFC3B33HH351102',
  miles: 78000,
  zip: '14450',
  year: 2017,
  make: 'Honda',
  model: 'Civic Coupe',
  trim: 'EX-T CVT',
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function listingSummary(listings: any[] | undefined) {
  return (listings ?? []).slice(0, 10).map(l => ({
    year: l.year,
    make: l.make,
    model: l.model,
    trim: l.trim,
    miles: l.miles,
    price: l.price,
    city: l.location?.city,
    state: l.location?.state,
    distance_miles: l.location?.distance_miles,
    hasVdpUrl: !!l.vdp_url,
    url_validated: l.url_validated ?? null,
  }))
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams
  if (sp.get('secret') !== SECRET) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const vin = sp.get('vin') || DEFAULTS.vin
  const miles = Number(sp.get('miles') || DEFAULTS.miles)
  const zip = sp.get('zip') || DEFAULTS.zip
  const subjectVehicle = {
    year: Number(sp.get('year') || DEFAULTS.year),
    make: sp.get('make') || DEFAULTS.make,
    model: sp.get('model') || DEFAULTS.model,
    trim: sp.get('trim') || DEFAULTS.trim,
  }

  const timing: Record<string, number> = {}
  const t0 = Date.now()

  // ── Primary call (VIN-based predict endpoint) ────────────────────────────────
  const pStart = Date.now()
  const primary = await fetchMarketCheckData(vin, miles, zip, false, undefined, subjectVehicle)
  timing.primaryMs = Date.now() - pStart

  const out: Record<string, unknown> = {
    input: { vin, miles, zip, subjectVehicle },
    primary: {
      success: primary.success,
      error: primary.error ?? null,
      statusCode: primary.statusCode ?? null,
      fallbackUsed: primary.fallbackUsed ?? false,
      predictedPrice: primary.data?.predictedPrice ?? null,
      msrp: primary.data?.msrp ?? null,
      priceRange: primary.data?.priceRange ?? null,
      confidence: primary.data?.confidence ?? null,
      totalComparablesFound: primary.data?.totalComparablesFound ?? null,
      comparablesStatsCount: primary.data?.comparablesStats?.price?.count ?? null,
      recentComparables: {
        num_found: primary.data?.recentComparables?.num_found ?? null,
        listingsAfterCleanCount: primary.data?.recentComparables?.listings?.length ?? 0,
        statsCount: primary.data?.recentComparables?.stats?.price?.count ?? null,
        sample: listingSummary(primary.data?.recentComparables?.listings),
      },
    },
  }

  // ── URL validation + supplement (exactly as the webhook does) ────────────────
  if (primary.success && primary.data) {
    let validatedPrediction = primary.data
    let validatedUrlCount = 0
    let urlFailedCount = 0
    let urlValidationSucceeded = false

    const vStart = Date.now()
    try {
      const urlResult = await validateListingUrls(primary.data)
      validatedPrediction = urlResult.prediction
      validatedUrlCount = urlResult.stats.validatedUrls.length
      urlFailedCount = urlResult.stats.failedCount
      urlValidationSucceeded = true
    } catch (err) {
      out.urlValidationError = err instanceof Error ? err.message : String(err)
    }
    timing.urlValidationMs = Date.now() - vStart

    out.afterUrlValidation = {
      ran: urlValidationSucceeded,
      validatedUrlCount,
      failedCount: urlFailedCount,
      listingsCount: validatedPrediction.recentComparables?.listings?.length ?? 0,
    }

    if (urlValidationSucceeded) {
      const sStart = Date.now()
      try {
        const supplementResult = await supplementComparables(
          validatedPrediction,
          validatedUrlCount,
          subjectVehicle,
          vin,
          miles,
          zip
        )
        timing.supplementMs = Date.now() - sStart
        out.afterSupplement = {
          supplemented: supplementResult.supplemented,
          listingsCount: supplementResult.prediction.recentComparables?.listings?.length ?? 0,
          sample: listingSummary(supplementResult.prediction.recentComparables?.listings),
        }
      } catch (err) {
        timing.supplementMs = Date.now() - sStart
        out.afterSupplement = {
          error: err instanceof Error ? err.message : String(err),
        }
      }
    }
  }

  timing.totalMs = Date.now() - t0
  out.timing = timing
  return NextResponse.json(out, { status: 200 })
}
