// app/api/cron/refresh-deals/route.js
import { fetchAmazonDeals } from '@/lib/feeds/amazon';
import { fetchWootDeals }    from '@/lib/feeds/woot';
import { fetchWalmartDeals } from '@/lib/feeds/walmart';
import { upsertDeals }       from '@/lib/db/upsertDeals';
import { getSupabaseAdmin }  from '@/lib/db/supabaseAdmin';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(req) {
    const auth = req.headers.get('authorization');
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

  const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
          console.error('[cron] supabaseAdmin is null — check NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars');
          return Response.json({ error: 'Supabase admin client not initialized' }, { status: 500 });
    }

  const startedAt = new Date();
    console.log('[cron] refresh-deals started at', startedAt.toISOString());

  try {
        const { error: expireError } = await supabaseAdmin
          .from('deals')
          .update({ status: 'expired' })
          .lt('expires_at', new Date().toISOString())
          .eq('status', 'active');

      if (expireError) console.error('[cron] expire error:', expireError);

      const [amazonDeals, wootDeals, walmartDeals] = await Promise.allSettled([
              fetchAmazonDeals(),
              fetchWootDeals(),
              fetchWalmartDeals(),
            ]);

      const amazon  = amazonDeals.status  === 'fulfilled' ? amazonDeals.value  : [];
        const woot    = wootDeals.status    === 'fulfilled' ? wootDeals.value    : [];
        const walmart = walmartDeals.status === 'fulfilled' ? walmartDeals.value : [];

      if (amazonDeals.status  === 'rejected') console.error('[cron] amazon failed:',  amazonDeals.reason);
        if (wootDeals.status    === 'rejected') console.error('[cron] woot failed:',    wootDeals.reason);
        if (walmartDeals.status === 'rejected') console.error('[cron] walmart failed:', walmartDeals.reason);

      console.log(`[cron] fetched — amazon: ${amazon.length}, woot: ${woot.length}, walmart: ${walmart.length}`);

      const allDeals = [...amazon, ...woot, ...walmart];
        const upserted = await upsertDeals(allDeals);

      await supabaseAdmin.from('deal_runs').insert({
              started_at:     startedAt.toISOString(),
              finished_at:    new Date().toISOString(),
              amazon_count:   amazon.length,
              woot_count:     woot.length,
              walmart_count:  walmart.length,
              total_upserted: upserted,
      });

      return Response.json({
              success: true,
              amazon:  amazon.length,
              woot:    woot.length,
              walmart: walmart.length,
              upserted,
      });

  } catch (err) {
        console.error('[cron] fatal error:', err);
        return Response.json({ error: err.message }, { status: 500 });
  }
}
