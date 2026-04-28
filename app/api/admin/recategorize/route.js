// app/api/admin/recategorize/route.js
// ONE-TIME migration: fixes category assignments for existing deals in the DB.
// DELETE THIS FILE after running once.
// Call: POST /api/admin/recategorize  (requires ADMIN_PASSWORD header)

import { getSupabaseAdmin } from '@/lib/db/supabaseAdmin'

export const runtime = 'nodejs'
export const maxDuration = 60

function auth(req) {
  const pw = process.env.ADMIN_PASSWORD
  if (!pw) return true
  return (req.headers.get('authorization') || '') === 'Bearer ' + pw
}

export async function POST(req) {
  if (!auth(req)) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const supabase = getSupabaseAdmin()
  const results  = {}

  // ── 1. Accessories wrongly in Computers ────────────────────────────────────
  // laptop stand, sleeve, bag, skin, cooler, case → Accessories
  const { count: c1, error: e1 } = await supabase
    .from('deals')
    .update({ category: 'Accessories' })
    .eq('category', 'Computers')
    .or('title.ilike.%laptop stand%,title.ilike.%laptop sleeve%,title.ilike.%laptop bag%,title.ilike.%laptop skin%,title.ilike.%laptop cooler%,title.ilike.%laptop case%,title.ilike.%laptop riser%,title.ilike.%laptop tray%,title.ilike.%laptop lock%,title.ilike.%notebook sleeve%,title.ilike.%notebook bag%,title.ilike.%computer bag%')
  results.laptopAccessories = { count: c1, error: e1?.message }

  // ── 2. Accessories wrongly in Computers — peripherals ──────────────────────
  const { count: c2, error: e2 } = await supabase
    .from('deals')
    .update({ category: 'Accessories' })
    .eq('category', 'Computers')
    .or('title.ilike.%usb hub%,title.ilike.%usb-c hub%,title.ilike.%docking station%,title.ilike.%monitor arm%,title.ilike.%monitor mount%,title.ilike.%monitor stand%,title.ilike.%monitor riser%,title.ilike.%keyboard cover%,title.ilike.%mouse pad%,title.ilike.%desk mat%,title.ilike.%wrist rest%,title.ilike.%cable management%,title.ilike.%kvm switch%')
  results.peripherals = { count: c2, error: e2?.message }

  // ── 3. Phone accessories wrongly in Phones ─────────────────────────────────
  const { count: c3, error: e3 } = await supabase
    .from('deals')
    .update({ category: 'Accessories' })
    .eq('category', 'Phones')
    .or('title.ilike.%phone case%,title.ilike.%iphone case%,title.ilike.%galaxy case%,title.ilike.%samsung case%,title.ilike.%phone cover%,title.ilike.%screen protector%,title.ilike.%tempered glass%,title.ilike.%phone holder%,title.ilike.%phone mount%,title.ilike.%phone stand%,title.ilike.%phone charger%,title.ilike.%pop socket%,title.ilike.%privacy screen%')
  results.phoneAccessories = { count: c3, error: e3?.message }

  // ── 4. Headphones / earbuds / speakers wrongly in Accessories ──────────────
  const { count: c4, error: e4 } = await supabase
    .from('deals')
    .update({ category: 'Electronics' })
    .eq('category', 'Accessories')
    .or('title.ilike.%headphones%,title.ilike.%earbuds%,title.ilike.%earphones%,title.ilike.%airpods%,title.ilike.%galaxy buds%,title.ilike.%noise cancelling%,title.ilike.%over-ear%,title.ilike.%on-ear%,title.ilike.%true wireless%,title.ilike.%bluetooth speaker%,title.ilike.%portable speaker%,title.ilike.%soundbar%')
  results.audioToElectronics = { count: c4, error: e4?.message }

  // ── 5. Headphones / earbuds / speakers wrongly in Computers ───────────────
  const { count: c5, error: e5 } = await supabase
    .from('deals')
    .update({ category: 'Electronics' })
    .eq('category', 'Computers')
    .or('title.ilike.%headphones%,title.ilike.%earbuds%,title.ilike.%earphones%,title.ilike.%airpods%,title.ilike.%bluetooth speaker%,title.ilike.%portable speaker%')
  results.audioFromComputers = { count: c5, error: e5?.message }

  const total = [c1,c2,c3,c4,c5].reduce((a,b) => a + (b || 0), 0)
  return Response.json({ ok: true, total_updated: total, results })
}
