function textBetween(value, start, end) {
  const startIndex = value.indexOf(start)
  if (startIndex === -1) return ''

  const from = startIndex + start.length
  const endIndex = value.indexOf(end, from)
  if (endIndex === -1) return ''

  return value.slice(from, endIndex)
}

function safeJsonParse(value) {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

function mapScrapedItem(item, provider) {
  return {
    source_key: provider.key,
    source_type: provider.type,
    merchant: provider.config?.merchant || provider.label?.toUpperCase() || '',
    external_id: item.external_id || item.externalId || item.sku || item.id || null,
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

function extractJsonLdItems(html) {
  const items = []
  const marker = '<script type="application/ld+json">'
  let remaining = html

  while (remaining.includes(marker)) {
    const raw = textBetween(remaining, marker, '</script>')
    if (!raw) break

    const parsed = safeJsonParse(raw.trim())
    if (Array.isArray(parsed)) {
      items.push(...parsed)
    } else if (parsed) {
      items.push(parsed)
    }

    const nextIndex = remaining.indexOf('</script>')
    if (nextIndex === -1) break
    remaining = remaining.slice(nextIndex + 9)
  }

  return items
}

function normalizeJsonLdItem(item, provider, fallbackUrl) {
  const offer = Array.isArray(item.offers) ? item.offers[0] : item.offers || {}

  return mapScrapedItem(
    {
      external_id: item.sku || item.productID || item.gtin || null,
      title: item.name || '',
      category: item.category || null,
      original_price: offer.highPrice || offer.priceSpecification?.price || null,
      sale_price: offer.price || offer.lowPrice || null,
      product_url: item.url || fallbackUrl || '',
      image_url: Array.isArray(item.image) ? item.image[0] : item.image || null,
      currency: offer.priceCurrency || 'USD',
      in_stock: !String(offer.availability || '').toLowerCase().includes('outofstock'),
    },
    provider
  )
}

export async function runScrapeAdapter(provider) {
  const config = provider?.config || {}

  if (Array.isArray(config.mockItems) && config.mockItems.length > 0) {
    return config.mockItems.map((item) => mapScrapedItem(item, provider))
  }

  if (!config.url) {
    return []
  }

  const response = await fetch(config.url, {
    method: 'GET',
    headers: config.headers || {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(`Scrape adapter failed for ${provider.key}: ${response.status}`)
  }

  const html = await response.text()

  if ((config.extract || 'jsonld') !== 'jsonld') {
    return []
  }

  const jsonLdItems = extractJsonLdItems(html)

  return jsonLdItems
    .filter((item) => item && (item['@type'] === 'Product' || item.name))
    .map((item) => normalizeJsonLdItem(item, provider, config.url))
    .filter((item) => item.title && item.product_url)
}
