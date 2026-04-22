function mapFeedItem(item, provider) {
  return {
    source_key: provider.key,
    source_type: provider.type,
    merchant: provider.config?.merchant || provider.label?.toUpperCase() || '',
    external_id: item.external_id || item.externalId || item.id || null,
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

export async function runFeedAdapter(provider) {
  const config = provider?.config || {}

  if (Array.isArray(config.mockItems) && config.mockItems.length > 0) {
    return config.mockItems.map((item) => mapFeedItem(item, provider))
  }

  if (!config.url) {
    return []
  }

  const response = await fetch(config.url, {
    method: 'GET',
    headers: config.headers || {},
    cache: 'no-store',
  })

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
