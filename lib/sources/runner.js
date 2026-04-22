import { runFeedAdapter } from '@/lib/sources/adapters/feedAdapter'
import { runApiAdapter } from '@/lib/sources/adapters/apiAdapter'
import { runScrapeAdapter } from '@/lib/sources/adapters/scrapeAdapter'

export async function runSource(provider) {
  if (!provider || !provider.type) {
    return {
      source: provider,
      items: [],
    }
  }

  switch (provider.type) {
    case 'feed':
      return {
        source: provider,
        items: await runFeedAdapter(provider),
      }

    case 'api':
      return {
        source: provider,
        items: await runApiAdapter(provider),
      }

    case 'scrape':
      return {
        source: provider,
        items: await runScrapeAdapter(provider),
      }

    default:
      return {
        source: provider,
        items: [],
      }
  }
}

export async function runSources(providers = []) {
  const results = []

  for (const provider of providers) {
    const result = await runSource(provider)
    results.push(result)
  }

  return results
}
