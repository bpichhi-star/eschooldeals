import { getSupabaseAdmin } from '@/lib/db/supabaseAdmin'

export async function createRun(triggerType) {
  const supabase = getSupabaseAdmin()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('deal_runs')
    .insert({
      trigger_type: triggerType,
      status: 'running',
    })
    .select('id')
    .single()

  if (error) throw error
  return data.id
}

export async function finishRun(runId, status, notes = null) {
  const supabase = getSupabaseAdmin()
  if (!supabase || !runId) return

  const { error } = await supabase
    .from('deal_runs')
    .update({
      status,
      notes,
      finished_at: new Date().toISOString(),
    })
    .eq('id', runId)

  if (error) throw error
}

export async function saveRawDeals(runId, sourceKey, rawDeals) {
  const supabase = getSupabaseAdmin()
  if (!supabase || !Array.isArray(rawDeals) || rawDeals.length === 0) return

  const rows = rawDeals.map((payload) => ({
    run_id: runId,
    source_key: sourceKey,
    payload,
  }))

  const { error } = await supabase.from('deals_raw').insert(rows)
  if (error) throw error
}

export async function upsertDeals(deals) {
  const supabase = getSupabaseAdmin()
  if (!supabase || !Array.isArray(deals) || deals.length === 0) return

  const payload = deals.map((deal) => ({
    ...deal,
    status: 'active',
    updated_at: new Date().toISOString(),
  }))

  const { error } = await supabase.from('deals').upsert(payload, {
    onConflict: 'source_key,product_url',
  })

  if (error) throw error
}
