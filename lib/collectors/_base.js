const merchantCatalog = {
  amazon: { merchant: 'AMAZON', source_type: 'feed' },
  walmart: { merchant: 'WALMART', source_type: 'feed' },
  target: { merchant: 'TARGET', source_type: 'feed' },
  bestbuy: { merchant: 'BEST BUY', source_type: 'feed' },
  woot: { merchant: 'WOOT', source_type: 'feed' },
  ebay: { merchant: 'EBAY', source_type: 'feed' },
  wayfair: { merchant: 'WAYFAIR', source_type: 'feed' },
  rei: { merchant: 'REI', source_type: 'feed' },
  macys: { merchant: 'MACY\'S', source_type: 'feed' },
  adidas: { merchant: 'ADIDAS', source_type: 'feed' },
}

export function createCollector(sourceKey) {
  return async function collectMerchantDeals() {
    const config = merchantCatalog[sourceKey]

    if (!config) {
      throw new Error(`Unknown collector source: ${sourceKey}`)
    }

    // Placeholder for live implementation.
    // Next step: wire affiliate feeds / APIs / scrapers per merchant here.
    return []
  }
}

export function getEnabledCollectorKeys() {
  return Object.keys(merchantCatalog)
}
