/**
 * @jest-environment node
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { upsertLead } from '@/lib/leads'

function makeSupabase(rpcError: unknown = null) {
  return {
    rpc: jest.fn().mockResolvedValue({ data: null, error: rpcError }),
  } as unknown as SupabaseClient
}

describe('upsertLead', () => {
  it('calls upsert_lead RPC with email and lead_type', async () => {
    const supabase = makeSupabase()
    await upsertLead(supabase, 'user@example.com', 'dispute_letter')
    expect(supabase.rpc).toHaveBeenCalledWith('upsert_lead', {
      p_email: 'user@example.com',
      p_lead_type: 'dispute_letter',
    })
  })

  it('resolves without throwing when RPC succeeds', async () => {
    const supabase = makeSupabase()
    await expect(upsertLead(supabase, 'a@b.com', 'form_submitted')).resolves.toBeUndefined()
  })

  it('throws when RPC returns an error', async () => {
    const supabase = makeSupabase({ message: 'DB error' })
    await expect(upsertLead(supabase, 'a@b.com', 'purchased')).rejects.toThrow('DB error')
  })

  it('passes purchased lead_type correctly', async () => {
    const supabase = makeSupabase()
    await upsertLead(supabase, 'buyer@example.com', 'purchased')
    expect(supabase.rpc).toHaveBeenCalledWith('upsert_lead', {
      p_email: 'buyer@example.com',
      p_lead_type: 'purchased',
    })
  })

  it('passes attribution fields through when provided', async () => {
    const supabase = makeSupabase()
    await upsertLead(supabase, 'user@example.com', 'form_submitted', {
      source: 'kb_article',
      kbSourceSlug: 'my-article',
    })
    expect(supabase.rpc).toHaveBeenCalledWith('upsert_lead', {
      p_email: 'user@example.com',
      p_lead_type: 'form_submitted',
      p_source: 'kb_article',
      p_kb_source_slug: 'my-article',
      p_utm_source: undefined,
      p_utm_medium: undefined,
      p_utm_campaign: undefined,
    })
  })

  it('omits attribution fields when not provided (backward compatible)', async () => {
    const supabase = makeSupabase()
    await upsertLead(supabase, 'user@example.com', 'dispute_letter')
    expect(supabase.rpc).toHaveBeenCalledWith('upsert_lead', {
      p_email: 'user@example.com',
      p_lead_type: 'dispute_letter',
    })
  })

  it('forwards vehicle attribution to the upsert_lead RPC', async () => {
    const supabase = makeSupabase()
    await upsertLead(supabase, 'user@example.com', 'form_submitted', {
      vehicleMake: 'Honda',
      vehicleModel: 'Accord',
      vehicleYear: 2021,
    })
    expect(supabase.rpc).toHaveBeenCalledWith('upsert_lead', {
      p_email: 'user@example.com',
      p_lead_type: 'form_submitted',
      p_source: undefined,
      p_kb_source_slug: undefined,
      p_utm_source: undefined,
      p_utm_medium: undefined,
      p_utm_campaign: undefined,
      p_vehicle_make: 'Honda',
      p_vehicle_model: 'Accord',
      p_vehicle_year: 2021,
    })
  })
})
