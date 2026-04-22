import { getSupabaseAdmin } from '@/lib/db/supabaseAdmin'

export async function createRun(triggerType) {
  const supabase = getSupabaseAdmin()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('ingest_log')
    .insert({
      source: triggerType,
      deals_added: 0,
      deals_updated: 0,
      error: null,
    })
    .select('id')
    .single()

  if (error) throw error
  return data.id
}

export async function finishRun(runId, { dealsAdded = 0, dealsUpdated = 0, error = null } = {}) {
  const supabase = getSupabaseAdmin()
  if (!supabase || !runId) return

  const { error: updateError } = await supabase
    .from('ingest_log')
    .update({
      deals_added: dealsAdded,
      deals_updated: dealsUpdated,
      error,
      ran_at: new Date().toISOString(),
    })
    .eq('id', runId)

  if (updateError) throw updateError
}

export async function saveRawDeals() {
  // Live schema does not currently persist a raw payload table.
  return
}

function mapDealForLiveSchema(deal) {
  return {
    title: deal.title,
    url: deal.product_url,
    price: deal.sale_price,
    original_price: deal.original_price,
    discount_pct: deal.discount_pct,
    store: deal.merchant,
    category: deal.category,
    image_url: deal.image_url,
    description: deal.description || null,
    is_active: deal.in_stock ?? true,
    expires_at: deal.expires_at || null,
    updated_at: new Date().toISOString(),
  }
}

export async function upsertDeals(deals) {
  const supabase = getSupabaseAdmin()
  if (!supabase || !Array.isArray(deals) || deals.length === 0) {
    return { dealsAdded: 0, dealsUpdated: 0 }
  }

  const urls = deals
    .map((deal) => deal.product_url)
    .filter(Boolean)

  const { data: existingRows, error: existingError } = await supabase
    .from('deals')
    .select('url')
    .in('url', urls)

  if (existingError) throw existingError

  const existingUrls = new Set((existingRows || []).map((row) => row.url))

  const payload = deals.map(mapDealForLiveSchema)

  const { error } = await supabase.from('deals').upsert(payload, {
    onConflict: 'url',
  })

  if (error) throw error

  let dealsAdded = 0
  let dealsUpdated = 0

  for (const row of payload) {
    if (existingUrls.has(row.url)) {
      dealsUpdated += 1
    } else {
      dealsAdded += 1
    }
  }

  return { dealsAdded, dealsUpdated }
}
