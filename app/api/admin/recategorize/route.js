// app/api/admin/recategorize/route.js
// Fixes category assignments for ALL existing deals in the DB.
// GET /api/admin/recategorize  — run once, then DELETE this file.

import { getSupabaseAdmin } from '@/lib/db/supabaseAdmin'
export const runtime = 'nodejs'
export const maxDuration = 60

async function run() {
  const supabase = getSupabaseAdmin()
  const r = {}

  // ── Move to ACCESSORIES ────────────────────────────────────────────────────
  // Laptop accessories wrongly in Computers
  const { count: c1 } = await supabase.from('deals').update({ category: 'Accessories' }).eq('category', 'Computers')
    .or('title.ilike.%laptop stand%,title.ilike.%laptop sleeve%,title.ilike.%laptop bag%,title.ilike.%laptop skin%,title.ilike.%laptop cooler%,title.ilike.%laptop case%,title.ilike.%laptop riser%,title.ilike.%laptop tray%,title.ilike.%laptop lock%,title.ilike.%notebook sleeve%,title.ilike.%notebook bag%,title.ilike.%computer bag%')
  r.laptopBagsFromComputers = c1

  // Cables wrongly in Computers
  const { count: c2 } = await supabase.from('deals').update({ category: 'Accessories' }).eq('category', 'Computers')
    .or('title.ilike.%usb cable%,title.ilike.%usb-c cable%,title.ilike.%hdmi cable%,title.ilike.%ethernet cable%,title.ilike.%lightning cable%,title.ilike.%displayport cable%,title.ilike.%thunderbolt cable%,title.ilike.%aux cable%,title.ilike.%charging cable%')
  r.cablesFromComputers = c2

  // Peripherals wrongly in Computers
  const { count: c3 } = await supabase.from('deals').update({ category: 'Accessories' }).eq('category', 'Computers')
    .or('title.ilike.%usb hub%,title.ilike.%usb-c hub%,title.ilike.%docking station%,title.ilike.%monitor arm%,title.ilike.%monitor mount%,title.ilike.%monitor stand%,title.ilike.%monitor riser%,title.ilike.%keyboard cover%,title.ilike.%mouse pad%,title.ilike.%desk mat%,title.ilike.%wrist rest%,title.ilike.%cable management%,title.ilike.%kvm switch%,title.ilike.%power bank%,title.ilike.%portable charger%,title.ilike.%wall charger%,title.ilike.%charging pad%,title.ilike.%wireless charger%,title.ilike.%power strip%,title.ilike.%surge protector%,title.ilike.%flash drive%,title.ilike.%usb drive%,title.ilike.%thumb drive%,title.ilike.%sd card%,title.ilike.%memory card%')
  r.peripheralsFromComputers = c3

  // Phone accessories wrongly in Phones
  const { count: c4 } = await supabase.from('deals').update({ category: 'Accessories' }).eq('category', 'Phones')
    .or('title.ilike.%phone case%,title.ilike.%iphone case%,title.ilike.%galaxy case%,title.ilike.%samsung case%,title.ilike.%phone cover%,title.ilike.%screen protector%,title.ilike.%tempered glass%,title.ilike.%phone holder%,title.ilike.%phone mount%,title.ilike.%phone stand%,title.ilike.%phone charger%,title.ilike.%pop socket%,title.ilike.%privacy screen%')
  r.phoneAccessories = c4

  // ── Move to ELECTRONICS ────────────────────────────────────────────────────
  // Headphones/earbuds wrongly in Accessories or Computers
  const { count: c5 } = await supabase.from('deals').update({ category: 'Electronics' })
    .in('category', ['Accessories', 'Computers', 'General'])
    .or('title.ilike.%headphones%,title.ilike.%earbuds%,title.ilike.%earphones%,title.ilike.%airpods%,title.ilike.%galaxy buds%,title.ilike.%noise cancelling%,title.ilike.%over-ear%,title.ilike.%on-ear%,title.ilike.%true wireless%,title.ilike.%bluetooth speaker%,title.ilike.%portable speaker%,title.ilike.%soundbar%')
  r.audioToElectronics = c5

  // ── Move to SPORTS ────────────────────────────────────────────────────────
  // Running shoes / sneakers wrongly in Fashion or General
  const { count: c6 } = await supabase.from('deals').update({ category: 'Sports' })
    .in('category', ['Fashion', 'General'])
    .or('title.ilike.%running shoes%,title.ilike.%trail shoes%,title.ilike.%athletic shoes%,title.ilike.%basketball shoes%,title.ilike.%tennis shoes%,title.ilike.%training shoes%,title.ilike.%gym shoes%,title.ilike.%workout shoes%,title.ilike.%cross training%,title.ilike.%nike shoes%,title.ilike.%adidas shoes%,title.ilike.%new balance%,title.ilike.%under armour shoes%,title.ilike.%cleats%')
  r.shoesToSports = c6

  // ── Move to HOME ──────────────────────────────────────────────────────────
  // Dog/pet beds and similar wrongly in General or Fashion
  const { count: c7 } = await supabase.from('deals').update({ category: 'Home' })
    .in('category', ['General', 'Fashion'])
    .or('title.ilike.%dog bed%,title.ilike.%pet bed%,title.ilike.%cat bed%,title.ilike.%pet crate%,title.ilike.%dog crate%')
  r.petBedsToHome = c7

  // ── Expire junk deals that should never show ───────────────────────────────
  // Office chair wheels, casters, completely irrelevant items — mark expired
  const { count: c8 } = await supabase.from('deals').update({ status: 'expired' })
    .eq('status', 'active')
    .or('title.ilike.%caster%,title.ilike.%chair wheel%,title.ilike.%office chair wheel%,title.ilike.%furniture leg%,title.ilike.%dog food%,title.ilike.%cat food%,title.ilike.%pet food%,title.ilike.%diaper%,title.ilike.%baby formula%,title.ilike.%oil filter%,title.ilike.%wiper blade%')
  r.junkExpired = c8

  // ── Fix merchants still showing SLICKDEALS ────────────────────────────────
  // Any deal with merchant = SLICKDEALS should have its merchant re-derived
  // For now mark them for re-ingest by setting status to expired
  const { count: c9 } = await supabase.from('deals').update({ status: 'expired' })
    .eq('merchant', 'SLICKDEALS')
  r.slickdealsExpired = c9

  const total = [c1,c2,c3,c4,c5,c6,c7,c8,c9].reduce((a,b) => a + (b||0), 0)
  return { ok: true, total_updated: total, breakdown: r }
}

export async function GET()  { return Response.json(await run()) }
export async function POST() { return Response.json(await run()) }
