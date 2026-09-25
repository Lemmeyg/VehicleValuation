/**
 * Export the list of past report purchasers to email for the Epic 3 (Scanned
 * Doc Agent) one-time backfill send. Run manually, once, before that send.
 *
 * Usage: npx tsx scripts/export-audit-backfill-recipients.ts
 */
import { writeFileSync } from 'node:fs'
import { supabaseAdmin } from '../lib/db/supabase'

async function main() {
  const { data, error } = await supabaseAdmin
    .from('reports')
    .select('email, id, created_at')
    .gt('price_paid', 0)
    .not('email', 'is', null)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Query failed:', error.message)
    process.exit(1)
  }

  const seen = new Set<string>()
  const rows: { email: string; report_id: string }[] = []

  for (const row of data ?? []) {
    const email = String(row.email).toLowerCase().trim()
    if (seen.has(email)) continue // keep only the most recent report per email
    seen.add(email)
    rows.push({ email, report_id: row.id as string })
  }

  const csv = ['email,report_id', ...rows.map(r => `${r.email},${r.report_id}`)].join('\n')
  writeFileSync('audit-backfill-recipients.csv', csv, 'utf-8')

  console.log(`Wrote ${rows.length} unique recipients to audit-backfill-recipients.csv`)
}

main()
