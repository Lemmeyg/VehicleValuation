import type { SupabaseClient } from '@supabase/supabase-js'

export type LeadType = 'dispute_letter' | 'form_submitted' | 'purchased'

export interface LeadAttribution {
  source?: string
  kbSourceSlug?: string
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
}

export async function upsertLead(
  supabase: SupabaseClient,
  email: string,
  leadType: LeadType,
  attribution?: LeadAttribution
): Promise<void> {
  const { error } = await supabase.rpc('upsert_lead', {
    p_email: email,
    p_lead_type: leadType,
    p_source: attribution?.source,
    p_kb_source_slug: attribution?.kbSourceSlug,
    p_utm_source: attribution?.utmSource,
    p_utm_medium: attribution?.utmMedium,
    p_utm_campaign: attribution?.utmCampaign,
  })
  if (error) {
    throw new Error(`[leads] upsert_lead RPC failed: ${error.message}`)
  }
}
