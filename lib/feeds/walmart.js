// lib/feeds/walmart.js
// Fetches Walmart deals via SerpApi Walmart Search
// Free tier: 250 searches/month — we use ~8/day = ~240/month

const SERPAPI_KEY = process.env.SERPAPI_KEY;
const AFFILIATE_TAG = process.env.WALMART_AFFILIATE_ID; // your Impact partner ID

// Searches to run daily — tuned for students + everyday shoppers
const SEARCH_QUERIES = [
  { query: 'laptop deal clearance',         category: 'Electronics',  studentBonus: true  },
  { query: 'headphones under 100',          category: 'Electronics',  studentBonus: true  },
  { query: 'tablet sale',                   category: 'Electronics',  studentBonus: true  },
  { query: 'monitor deal',                  category: 'Electronics',  studentBonus: false },
  { query: 'USB hub charging station',      category: 'Electronics',  studentBonus: true  },
  { query: 'backpack school bag',           category: 'School',       studentBonus: true  },
  { query: 'phone charger cable deal',      category: 'Electronics',  studentBonus: true  },
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
    engine: 'walmart',
    query,
    api_key: SERPAPI_KEY,
    sort_by: 'best_seller', // best_seller | price_low | price_high | rating
  });

  const res = await fetch(`https://serpapi.com/search.json?${params}`);
  if (!res.ok) {
    console.error(`[walmart] SerpApi error for "${query}": ${res.status}`);
    return [];
  }

  const data = await res.json();
  const results = data.organic_results || [];

  return results
    .filter(item => item.primary_offer?.offer_price && item.thumbnail)
    .slice(0, 10) // max 10 per search query
    .map(item => {
      const salePrice = parseFloat(item.primary_offer.offer_price);
      const originalPrice = item.was_price
        ? parseFloat(item.was_price)
        : null;
      const discountPct = calcDiscountPct(salePrice, originalPrice);

      return {
        source_key:    'walmart',
        external_id:   String(item.us_item_id || item.product_id),
        merchant:      'WALMART',
        source_type:   'feed',
        title:         item.title,
        category,
        salePrice,
        originalPrice,
        discountPct,
        url:           buildAffiliateUrl(item.product_page_url || item.link),
        image:         item.thumbnail,
        currency:      'USD',
        inStock:       true,
        isStudentPick: studentBonus && discountPct >= 10,
        isFeatured:    false,
        rating:        item.rating || null,
      };
    });
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
  const seen = new Set();
  const unique = deals.filter(d => {
    if (seen.has(d.external_id)) return false;
    seen.add(d.external_id);
    return true;
  });

  console.log(`[walmart] Fetched ${unique.length} unique deals`);
  return unique;
}
