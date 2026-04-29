// app/api/deals/archive/route.js
// Returns deals for a specific date (up to 7 days back).
// Query: GET /api/deals/archive?date=2025-04-22
// Date must be YYYY-MM-DD in ET. Returns today's active deals if no date given.

import { getSupabaseAdmin, hasSupabaseAdminEnv } from '@/lib/db/supabaseAdmin'

const STUDENT_CATEGORIES = ['Electronics','Computers','Phones','Accessories','Home','Fashion','Sports','General']
const MAX_DAYS_BACK = 7

function startOfDayET(dateStr) {
  // dateStr = 'YYYY-MM-DD', returns UTC ISO for midnight ET on that date
  const dt = new Date(dateStr + 'T00:00:00')
  // ET is UTC-5 (EST) or UTC-4 (EDT) — use toLocaleString to get actual offset
  const etMidnight = new Date(new Date(dateStr + 'T00:00:00').toLocaleString('en-US', { timeZone: 'America/New_York' }))
  const utcMidnight = new Date(dateStr + 'T00:00:00')
  const offsetMs = etMidnight.getTime() - utcMidnight.getTime()
  return new Date(utcMidnight.getTime() - offsetMs).toISOString()
}

function todayET() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' }) // YYYY-MM-DD
}

export async function GET(req) {
  if (!hasSupabaseAdminEnv()) return Response.json({ deals: [], error: 'No DB' })
  const supabase = getSupabaseAdmin()
  if (!supabase) return Response.json({ deals: [], error: 'No DB client' })

  const { searchParams } = new URL(req.url)
  const today    = todayET()
  const dateParam = searchParams.get('date') || today

  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    return Response.json({ error: 'Invalid date format. Use YYYY-MM-DD.' }, { status: 400 })
  }

  // Don't allow future dates or dates older than 7 days
  const requested = new Date(dateParam)
  const todayDate = new Date(today)
  const diffDays  = Math.floor((todayDate - requested) / (1000 * 60 * 60 * 24))

  if (diffDays < 0) return Response.json({ error: 'Cannot fetch future deals.' }, { status: 400 })
  if (diffDays > MAX_DAYS_BACK) return Response.json({ error: 'Deals only available for the past 7 days.' }, { status: 400 })

  const isToday  = dateParam === today
  const rangeStart = startOfDayET(dateParam)
  const nextDate   = new Date(dateParam)
  nextDate.setDate(nextDate.getDate() + 1)
  const rangeEnd   = startOfDayET(nextDate.toLocaleDateString('en-CA', { timeZone: 'America/New_York' }))

  // A deal was "live during day X" if it was first seen on or before the end
  // of day X (created_at <= rangeEnd) AND last seen on or after the start of
  // day X (fetched_at >= rangeStart). Status is ignored — a recurring deal
  // appears under every day it was visible, and a deal that has since
  // expired still appears under the days it was live. Calendar shows the
  // last 7 days; anything older falls off via purgeOldDeals.
  const query = supabase
    .from('deals')
    .select('*')
    .in('category', STUDENT_CATEGORIES)
    .gt('sale_price', 0)
    .lt('created_at', rangeEnd)
    .gte('fetched_at', rangeStart)
    .order('discount_pct', { ascending: false, nullsFirst: false })
    .limit(500)

  const { data, error } = await query
  if (error) return Response.json({ error: error.message }, { status: 500 })

  const deals = (data || []).map((deal, i) => ({
    id:            deal.id ?? 'deal-' + i,
    title:         deal.title || '',
    merchant:      deal.merchant || '',
    category:      deal.category || 'General',
    originalPrice: deal.original_price != null ? Number(deal.original_price) : null,
    salePrice:     deal.sale_price     != null ? Number(deal.sale_price)     : null,
    discountPct:   deal.discount_pct ?? 0,
    url:           deal.product_url || '',
    image:         deal.image_url || null,
    isStudentPick: Boolean(deal.is_student_relevant),
  }))

  return Response.json({ date: dateParam, isToday, count: deals.length, deals })
}
