function mapApiItem(item, provider) {
  return {
    source_key: provider.key,
    source_type: provider.type,
    merchant: provider.config?.merchant || provider.label?.toUpperCase() || '',
    external_id: item.external_id || item.externalId || item.id || item.sku || null,
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

function extractApiItems(payload) {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.items)) return payload.items
  if (Array.isArray(payload?.deals)) return payload.deals
  if (Array.isArray(payload?.results)) return payload.results
  if (Array.isArray(payload?.products)) return payload.products
  return []
}

export async function runApiAdapter(provider) {
  const config = provider?.config || {}

  if (Array.isArray(config.mockItems) && config.mockItems.length > 0) {
    return config.mockItems.map((item) => mapApiItem(item, provider))
  }

  if (!config.url) {
    return []
  }

  const response = await fetch(config.url, {
    method: config.method || 'GET',
    headers: config.headers || {},
    body: config.body ? JSON.stringify(config.body) : undefined,
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(`API adapter failed for ${provider.key}: ${response.status}`)
  }

  const payload = await response.json()
  const items = extractApiItems(payload)

  return items.map((item) => mapApiItem(item, provider))
}
