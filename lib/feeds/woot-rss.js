// lib/feeds/woot-rss.js
// Woot public RSS feed parser — no API key needed

const WOOT_FEEDS = [
  { url: 'https://www.woot.com/feeds/all.rss', category: 'Electronics' },
  { url: 'https://computers.woot.com/feeds/all.rss', category: 'Computers' },
  { url: 'https://electronics.woot.com/feeds/all.rss', category: 'Electronics' },
];

function parsePrice(str) {
  if (!str) return null;
  const match = str.match(/\$?([\d,]+\.?\d*)/);
  return match ? parseFloat(match[1].replace(',', '')) : null;
}

function extractPrices(title, description) {
  const combined = title + ' ' + description;
  const prices = [...combined.matchAll(/\$[\d,]+\.?\d*/g)].map(m => parsePrice(m[0]));
  return prices.filter(Boolean).sort((a, b) => a - b);
}

export async function fetchWootRss() {
  const deals = [];

  for (const feed of WOOT_FEEDS) {
    let xml;
    try {
      const res = await fetch(feed.url, { headers: { 'User-Agent': 'eschooldeals-bot/1.0' } });
      if (!res.ok) { console.error('[woot-rss] HTTP ' + res.status); continue; }
      xml = await res.text();
    } catch (e) {
      console.error('[woot-rss] fetch error:', e.message);
      continue;
    }

    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];

    for (const [, block] of items) {
      const title = (
        block.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) ||
        block.match(/<title>(.*?)<\/title>/)
      )?.[1]?.trim();
      const link = (block.match(/<link>(.*?)<\/link>/) || [])[1]?.trim();
      const description = (block.match(/<description>([\s\S]*?)<\/description>/))?.[1]?.trim() || '';
      const image = (description.match(/<img[^>]+src=["'](https?:\/\/[^"']+)["']/i) || [])[1];

      if (!title || !link) continue;

      const prices = extractPrices(title, description);
      const salePrice = prices[0] ?? null;
      const originalPrice = prices[1] ?? null;

      if (!salePrice) continue;

      const discount = originalPrice && originalPrice > salePrice
        ? Math.round(((originalPrice - salePrice) / originalPrice) * 100) : null;

      deals.push({
        source_key: 'woot-rss',
        merchant: 'Woot',
        source_type: 'feed',
        external_id: link.split('/').pop() || link,
        title,
        category: feed.category,
        original_price: originalPrice,
        sale_price: salePrice,
        discount_pct: discount,
        product_url: link,
        image_url: image || null,
        currency: 'USD',
        in_stock: true,
        is_student_relevant: /laptop|headphone|tablet|monitor|keyboard|mouse|usb|charger|kindle|ipad|macbook|backpack|speaker|webcam|printer/i.test(title),
        is_featured: false,
        score: (discount ?? 0) + (salePrice < 50 ? 20 : salePrice < 100 ? 10 : 0),
        status: 'active',
        fetched_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      });
    }
  }

  console.log('[woot-rss] fetched ' + deals.length + ' deals');
  return deals;
}
