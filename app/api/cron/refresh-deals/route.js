// app/api/cron/refresh-deals/route.js
// Sources: Walmart + Woot via SerpApi — ALL land as 'pending' for manual review at /admin
// Amazon: manual via SiteStripe — no automated fetch
// Woot CJ: removed (approval stalled, no ETA)
import { fetchWootSerp }     from '@/lib/feeds/woot-serp';
import { fetchWalmartDeals } from '@/lib/feeds/walmart';
import { upsertDeals }       from '@/lib/db/upsertDeals';
import { getSupabaseAdmin }  from '@/lib/db/supabaseAdmin';

export const runtime     = 'nodejs';
export const maxDuration = 60;

export async function GET(req) {
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    console.error('[cron] supabaseAdmin is null — check env vars');
    return Response.json({ error: 'Supabase admin client not initialized' }, { status: 500 });
  }

  const startedAt = new Date();
  console.log('[cron] refresh-deals started at', startedAt.toISOString());

  try {
    // Expire stale active deals
    const { error: expireError } = await supabaseAdmin
      .from('deals')
      .update({ status: 'expired' })
      .lt('expires_at', new Date().toISOString())
      .eq('status', 'active');
    if (expireError) console.error('[cron] expire error:', expireError);

    // Fetch all SerpApi sources in parallel
    const [walmartRes, wootSerpRes] = await Promise.allSettled([
      fetchWalmartDeals(),
      fetchWootSerp(),
    ]);

    const walmart  = walmartRes.status  === 'fulfilled' ? walmartRes.value  : [];
    const wootSerp = wootSerpRes.status === 'fulfilled' ? wootSerpRes.value : [];

    if (walmartRes.status  === 'rejected') console.error('[cron] walmart failed:',   walmartRes.reason);
    if (wootSerpRes.status === 'rejected') console.error('[cron] woot-serp failed:', wootSerpRes.reason);

    const allDeals = [...walmart, ...wootSerp];
    console.log(`[cron] fetched — walmart: ${walmart.length}, woot-serp: ${wootSerp.length} — all pending your review`);

    const { count } = allDeals.length
      ? await upsertDeals(allDeals, { status: 'pending' })
      : { count: 0 };

    await supabaseAdmin.from('deal_runs').insert({
      started_at:     startedAt.toISOString(),
      finished_at:    new Date().toISOString(),
      amazon_count:   0,
      woot_count:     wootSerp.length,
      walmart_count:  walmart.length,
      total_upserted: count ?? 0,
    });

    return Response.json({
      success:          true,
      walmart:          walmart.length,
      'woot-serp':      wootSerp.length,
      pending_upserted: count ?? 0,
      note:             'All deals pending — approve at /admin',
    });
  } catch (err) {
    console.error('[cron] fatal error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
