// lib/feeds/walmart.js
// Fetches Walmart deals via SerpApi Walmart Search
// Free tier: 250 searches/month — we use 7/day = 210/month

const SERPAPI_KEY = process.env.SERPAPI_KEY;
const AFFILIATE_TAG = process.env.WALMART_AFFILIATE_ID;

const SEARCH_QUERIES = [
  { query: 'laptop deal clearance',     category: 'Electronics', studentBonus: true  },
  { query: 'headphones under 100',      category: 'Electronics', studentBonus: true  },
  { query: 'tablet sale',               category: 'Electronics', studentBonus: true  },
  { query: 'monitor deal',              category: 'Electronics', studentBonus: false },
  { query: 'USB hub charging station',  category: 'Electronics', studentBonus: true  },
  { query: 'backpack school bag',       category: 'School',      studentBonus: true  },
  { query: 'phone charger cable deal',  category: 'Electronics', studentBonus: true  },
];

function buildAffiliateUrl(url) {
  if (!AFFILIATE_TAG) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}veh=aff&wmlspartner=${AFFILIATE_TAG}`;
}

function calcDiscountPct(salePrice, originalPrice) {
  if (!originalPrice || originalPrice <= salePrice) return 0;
  return Math.round(((originalPrice - salePrice) / originalPrice) * 100);
}

async function searchWalmart({ query, category, studentBonus }) {
  const params = new URLSearchParams({
    engine:  'walmart',
    query,
    api_key: SERPAPI_KEY,
    sort_by: 'best_seller',
  });

  const res = await fetch(`https://serpapi.com/search.json?${params}`);
  if (!res.ok) {
    console.error(`[walmart] SerpApi error for "${query}": ${res.status}`);
    return [];
  }

  const data    = await res.json();
  const results = data.organic_results || [];

  return results
    .filter(item => {
      const price = parseFloat(item.primary_offer?.offer_price);
      return price > 0 && item.thumbnail && item.product_page_url;
    })
    .slice(0, 10)
    .map(item => {
      const sale_price = parseFloat(item.primary_offer?.offer_price);
      if (!sale_price || sale_price <= 0) return null;

      const original_price = item.was_price ? parseFloat(item.was_price) : null;
      const discount_pct   = calcDiscountPct(sale_price, original_price);

      return {
        source_key:          'walmart',
        external_id:         String(item.us_item_id || item.product_id),
        merchant:            'WALMART',
        source_type:         'feed',
        title:               item.title,
        category,
        sale_price,
        original_price,
        discount_pct,
        product_url:         buildAffiliateUrl(item.product_page_url),
        image_url:           item.thumbnail,
        currency:            'USD',
        in_stock:            true,
        is_student_relevant: studentBonus && discount_pct >= 10,
        is_featured:         false,
      };
    })
    .filter(Boolean);
}

export async function fetchWalmartDeals() {
  if (!SERPAPI_KEY) {
    console.warn('[walmart] SERPAPI_KEY not set — skipping');
    return [];
  }

  console.log('[walmart] Starting fetch across', SEARCH_QUERIES.length, 'queries');

  const results = await Promise.allSettled(
    SEARCH_QUERIES.map(q => searchWalmart(q))
  );

  const deals = results
    .filter(r => r.status === 'fulfilled')
    .flatMap(r => r.value);

  // Dedupe by external_id
  const seen   = new Set();
  const unique = deals.filter(d => {
    if (!d?.external_id) return false;
    if (seen.has(d.external_id)) return false;
    seen.add(d.external_id);
    return true;
  });

  console.log(`[walmart] Fetched ${unique.length} unique deals`);
  return unique;
}
