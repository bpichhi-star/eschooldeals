function mapFeedItem(item, provider) {
  return {
    source_key: provider.key,
    source_type: provider.type,
    merchant: provider.config?.merchant || provider.label?.toUpperCase() || '',
    external_id: item.external_id || item.externalId || item.id || item.asin || null,
    title: item.title || item.name || '',
    category: item.category || null,
    original_price: item.original_price ?? item.originalPrice ?? item.msrp ?? null,
    sale_price: item.sale_price ?? item.salePrice ?? item.price ?? null,
    discount_pct: item.discount_pct ?? item.discountPct ?? null,
    product_url: item.product_url || item.productUrl || item.url || '',
    image_url: item.image_url || item.imageUrl || item.image || null,
    currency: item.currency || 'USD',
    in_stock: item.in_stock ?? item.inStock ?? true,
    is_student_relevant: item.is_student_relevant ?? item.isStudentRelevant ?? false,
    is_featured: item.is_featured ?? item.isFeatured ?? false,
    fetched_at: new Date().toISOString(),
    expires_at: item.expires_at || item.expiresAt || null,
  }
}

function extractFeedItems(payload) {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.items)) return payload.items
  if (Array.isArray(payload?.deals)) return payload.deals
  if (Array.isArray(payload?.products)) return payload.products
  return []
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timeoutId)
  }
}

function findBetween(text, start, end, fromIndex = 0) {
  const startIndex = text.indexOf(start, fromIndex)
  if (startIndex === -1) return null
  const valueStart = startIndex + start.length
  const endIndex = text.indexOf(end, valueStart)
  if (endIndex === -1) return null
  return text.slice(valueStart, endIndex)
}

function extractFirstDollarNumber(text) {
  if (!text) return null
  const cleaned = text.replace(/,/g, '')
  const match = cleaned.match(/\$([0-9]+(?:\.[0-9]{2})?)/)
  return match?.[1] ? Number(match[1]) : null
}

function extractPriceFromHtml(html) {
  const candidates = [
    findBetween(html, 'id="priceblock_ourprice"', '</span>'),
    findBetween(html, 'id="priceblock_dealprice"', '</span>'),
    findBetween(html, '"displayPrice":"', '"'),
    findBetween(html, '"priceAmount":', ','),
  ]

  for (const candidate of candidates) {
    const price = extractFirstDollarNumber(candidate) ?? Number(candidate)
    if (Number.isFinite(price) && price > 0) {
      return price
    }
  }

  return null
}

function stripTags(value) {
  return String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractTitleFromHtml(html, fallbackAsin) {
  const productTitleBlock = findBetween(html, 'id="productTitle"', '</span>')
  const titleFromProduct = stripTags(productTitleBlock)
  if (titleFromProduct) return titleFromProduct

  const titleTag = findBetween(html, '<title>', '</title>')
  const titleFromTag = stripTags(titleTag)
  if (titleFromTag) return titleFromTag

  return fallbackAsin
}

function extractImageFromHtml(html, asin) {
  const raw = findBetween(html, '"large":"', '"')
  if (raw) {
    return raw.replace(/\\u0026/g, '&')
  }

  return `https://images-na.ssl-images-amazon.com/images/P/${asin}.01._SL300_.jpg`
}

async function fetchAmazonAsinItem(itemConfig, provider) {
  const asin = itemConfig.asin
  const affiliateTag = provider?.config?.affiliateTag || 'eschooldeals-20'
  const url = `https://www.amazon.com/dp/${asin}?tag=${affiliateTag}`

  const response = await fetchWithTimeout(
    url,
    {
      method: 'GET',
      cache: 'no-store',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    },
    provider?.config?.timeoutMs || 8000
  )

  if (!response.ok) {
    throw new Error(`Amazon fetch failed for ${asin}: ${response.status}`)
  }

  const html = await response.text()
  const price = extractPriceFromHtml(html)

  return mapFeedItem(
    {
      id: asin,
      title: extractTitleFromHtml(html, asin),
      category: itemConfig.category || null,
      sale_price: price,
      original_price: itemConfig.original_price ?? price,
      discount_pct: itemConfig.discount_pct ?? 0,
      url,
      image: extractImageFromHtml(html, asin),
      in_stock: true,
      is_student_relevant: Boolean(itemConfig.is_student_relevant),
    },
    provider
  )
}

export async function runFeedAdapter(provider) {
  const config = provider?.config || {}

  if (config.mode === 'amazon_asins' && Array.isArray(config.items) && config.items.length > 0) {
    const settled = await Promise.allSettled(
      config.items.map((item) => fetchAmazonAsinItem(item, provider))
    )

    return settled
      .filter((entry) => entry.status === 'fulfilled')
      .map((entry) => entry.value)
      .filter((item) => item.title && item.product_url)
  }

  if (Array.isArray(config.mockItems) && config.mockItems.length > 0) {
    return config.mockItems.map((item) => mapFeedItem(item, provider))
  }

  if (!config.url) {
    return []
  }

  const response = await fetchWithTimeout(
    config.url,
    {
      method: 'GET',
      headers: config.headers || {},
      cache: 'no-store',
    },
    config.timeoutMs || 8000
  )

  if (!response.ok) {
    throw new Error(`Feed adapter failed for ${provider.key}: ${response.status}`)
  }

  const format = config.format || 'json'
  if (format !== 'json') {
    return []
  }

  const payload = await response.json()
  const items = extractFeedItems(payload)

  return items.map((item) => mapFeedItem(item, provider))
}
