import type { SupabaseClient } from '@supabase/supabase-js'

export type LeadType = 'dispute_letter' | 'form_submitted' | 'purchased'

export async function upsertLead(
  supabase: SupabaseClient,
  email: string,
  leadType: LeadType
): Promise<void> {
  const { error } = await supabase.rpc('upsert_lead', {
    p_email: email,
    p_lead_type: leadType,
  })
  if (error) {
    throw new Error(`[leads] upsert_lead RPC failed: ${error.message}`)
  }
}
