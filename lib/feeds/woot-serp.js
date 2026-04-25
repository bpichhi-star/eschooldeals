// lib/feeds/woot-serp.js
// Searches Woot deals via SerpApi Google Shopping
// All results land as status:'pending' — approve manually via /admin
// Budget note: 3 queries/day + 7 Walmart = 10/day = ~300/mo (slightly over 250 free tier)

const SERPAPI_KEY = process.env.SERPAPI_KEY;

const WOOT_QUERIES = [
  { query: 'woot laptop deal',     category: 'Computers'   },
  { query: 'woot headphones deal', category: 'Electronics' },
  { query: 'woot tablet sale',     category: 'Electronics' },
];

function parsePrice(str) {
  if (!str) return null;
  const match = String(str).replace(/,/g, '').match(/[\d]+\.?\d*/);
  return match ? parseFloat(match[0]) : null;
}

async function searchWoot({ query, category }) {
  const params = new URLSearchParams({ engine: 'google_shopping', q: query, api_key: SERPAPI_KEY, num: 20 });
  let data;
  try {
    const res = await fetch('https://serpapi.com/search.json?' + params);
    if (!res.ok) { console.error('[woot-serp] HTTP ' + res.status + ' for "' + query + '"'); return []; }
    data = await res.json();
  } catch (e) { console.error('[woot-serp] fetch error:', e.message); return []; }

  return (data.shopping_results || [])
    .filter(item => (item.source||'').toLowerCase().includes('woot') || (item.link||'').toLowerCase().includes('woot.com'))
    .map(item => {
      const salePrice = parsePrice(item.price);
      if (!salePrice) return null;
      const origPrice = parsePrice(item.original_price) || null;
      const discount  = origPrice && origPrice > salePrice ? Math.round(((origPrice-salePrice)/origPrice)*100) : null;
      return {
        source_key: 'woot-serp', merchant: 'Woot', source_type: 'feed',
        external_id: item.product_id || item.docid || String(item.position)+'-'+query,
        title: item.title || '', category,
        original_price: origPrice, sale_price: salePrice, discount_pct: discount,
        product_url: item.link || '', image_url: item.thumbnail || null,
        currency: 'USD', in_stock: true,
        is_student_relevant: /laptop|headphone|tablet|monitor|keyboard|mouse|usb|charger|kindle|ipad|macbook|backpack|speaker|webcam|printer/i.test(item.title||''),
        is_featured: false,
        score: (discount??0)+(salePrice<50?20:salePrice<100?10:0),
        status: 'pending',
        fetched_at: new Date().toISOString(),
        expires_at: new Date(Date.now()+7*24*60*60*1000).toISOString(),
      };
    }).filter(Boolean);
}

export async function fetchWootSerp() {
  if (!SERPAPI_KEY) { console.warn('[woot-serp] SERPAPI_KEY not set'); return []; }
  const settled = await Promise.allSettled(WOOT_QUERIES.map(q => searchWoot(q)));
  const deals   = settled.filter(r => r.status==='fulfilled').flatMap(r => r.value);
  const seen = new Set();
  const unique = deals.filter(d => { if (!d?.external_id||seen.has(d.external_id)) return false; seen.add(d.external_id); return true; });
  console.log('[woot-serp] fetched ' + unique.length + ' pending deals');
  return unique;
}
