function safeJsonParse(value) {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

function firstNonEmpty(...values) {
  for (const value of values) {
    if (value !== null && value !== undefined && String(value).trim() !== '') {
      return value
    }
  }
  return null
}

function absoluteUrl(baseUrl, maybeUrl) {
  if (!maybeUrl) return ''
  try {
    return new URL(maybeUrl, baseUrl).toString()
  } catch {
    return ''
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

function extractJsonLdBlocks(html) {
  const regex =
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi

  const matches = []
  let match

  while ((match = regex.exec(html)) !== null) {
    if (match[1]) {
      matches.push(match[1].trim())
    }
  }

  return matches
}

function flattenJsonLdNode(node, output = []) {
  if (!node) return output

  if (Array.isArray(node)) {
    for (const item of node) {
      flattenJsonLdNode(item, output)
    }
    return output
  }

  output.push(node)

  if (node['@graph']) flattenJsonLdNode(node['@graph'], output)
  if (node.itemListElement) flattenJsonLdNode(node.itemListElement, output)
  if (node.item) flattenJsonLdNode(node.item, output)

  return output
}

function extractJsonLdItems(html) {
  const blocks = extractJsonLdBlocks(html)
  const items = []

  for (const block of blocks) {
    const parsed = safeJsonParse(block)
    if (!parsed) continue
    flattenJsonLdNode(parsed, items)
  }

  return items
}

function getOffer(item) {
  if (!item) return {}
  if (Array.isArray(item.offers)) return item.offers[0] || {}
  if (item.offers) return item.offers
  if (item.priceSpecification) return { priceSpecification: item.priceSpecification }
  return {}
}

function normalizeJsonLdItem(item, provider, fallbackUrl) {
  const offer = getOffer(item)
  const priceSpec = offer.priceSpecification || {}

  const url = absoluteUrl(
    fallbackUrl,
    firstNonEmpty(item.url, item['@id'], offer.url, fallbackUrl)
  )

  const image = firstNonEmpty(
    Array.isArray(item.image) ? item.image[0] : item.image,
    item.thumbnailUrl,
    item.contentUrl
  )

  const salePrice = firstNonEmpty(
    offer.price,
    offer.lowPrice,
    item.price,
    priceSpec.price
  )

  const originalPrice = firstNonEmpty(
    offer.highPrice,
    item.msrp,
    item.listPrice,
    priceSpec.price
  )

  const availability = String(
    firstNonEmpty(offer.availability, item.availability, '') || ''
  )
  const inStock = !availability.toLowerCase().includes('outofstock')

  return mapScrapedItem(
    {
      external_id: firstNonEmpty(item.sku, item.productID, item.gtin, item.mpn),
      title: firstNonEmpty(item.name, item.title),
      category: firstNonEmpty(item.category, item.itemCategory),
      original_price: originalPrice,
      sale_price: salePrice,
      product_url: url,
      image_url: image ? absoluteUrl(fallbackUrl, image) : null,
      currency: firstNonEmpty(offer.priceCurrency, item.priceCurrency, 'USD'),
      in_stock: inStock,
    },
    provider
  )
}

function looksLikeDealItem(item) {
  if (!item || typeof item !== 'object') return false

  const type = item['@type']
  const hasName = Boolean(item.name || item.title)
  const hasUrl = Boolean(item.url || item['@id'])
  const hasOffer = Boolean(item.offers || item.price || item.priceSpecification)

  return (
    type === 'Product' ||
    type === 'ListItem' ||
    (hasName && hasUrl) ||
    (hasName && hasOffer)
  )
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

export async function runScrapeAdapter(provider) {
  const config = provider?.config || {}

  if (Array.isArray(config.mockItems) && config.mockItems.length > 0) {
    return config.mockItems.map((item) => mapScrapedItem(item, provider))
  }

  if (!config.url) {
    return []
  }

  const response = await fetchWithTimeout(
    config.url,
    {
      method: 'GET',
      headers:
        config.headers || {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      cache: 'no-store',
    },
    config.timeoutMs || 8000
  )

  if (!response.ok) {
    throw new Error(`Scrape adapter failed for ${provider.key}: ${response.status}`)
  }

  const html = await response.text()

  if ((config.extract || 'jsonld') !== 'jsonld') {
    return []
  }

  const jsonLdItems = extractJsonLdItems(html)

  return jsonLdItems
    .filter(looksLikeDealItem)
    .map((item) => normalizeJsonLdItem(item, provider, config.url))
    .filter((item) => item.title && item.product_url && item.sale_price)
}
