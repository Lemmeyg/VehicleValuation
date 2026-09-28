/**
 * One-time (or occasional re-run) backfill: submit every URL currently in
 * the live sitemap to IndexNow, so Bing/Yandex catch up on pages that went
 * live before IndexNow submission existed, or that were published outside
 * the normal upload flow (e.g. a direct Supabase edit).
 *
 * Requires the IndexNow key file (public/<key>.txt) to already be live in
 * production — IndexNow verifies ownership by fetching it. Run this only
 * after the feat/indexnow-submission deploy has gone out.
 *
 * Run: npx tsx scripts/backfill-indexnow.ts
 */
import { submitToIndexNow } from '../lib/indexnow'

const SITEMAP_URL = 'https://www.totallosstoolkit.com/sitemap.xml'

async function main() {
  const res = await fetch(SITEMAP_URL)
  if (!res.ok) {
    console.error(`Failed to fetch sitemap: ${res.status} ${res.statusText}`)
    process.exit(1)
  }

  const xml = await res.text()
  const urls = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map(m => m[1])

  if (urls.length === 0) {
    console.error('No <loc> URLs found in sitemap — aborting.')
    process.exit(1)
  }

  console.log(`Submitting ${urls.length} URLs from ${SITEMAP_URL} to IndexNow...`)
  await submitToIndexNow(urls)
  console.log('Done.')
}

main()
