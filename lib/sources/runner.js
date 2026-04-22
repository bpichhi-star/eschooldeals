import { runFeedAdapter } from '@/lib/sources/adapters/feedAdapter'
import { runApiAdapter } from '@/lib/sources/adapters/apiAdapter'
import { runScrapeAdapter } from '@/lib/sources/adapters/scrapeAdapter'

export async function runSource(provider) {
  if (!provider || !provider.type) {
    return {
      source: provider,
      items: [],
      error: 'Invalid provider',
    }
  }

  try {
    switch (provider.type) {
      case 'feed':
        return {
          source: provider,
          items: await runFeedAdapter(provider),
          error: null,
        }

      case 'api':
        return {
          source: provider,
          items: await runApiAdapter(provider),
          error: null,
        }

      case 'scrape':
        return {
          source: provider,
          items: await runScrapeAdapter(provider),
          error: null,
        }

      default:
        return {
          source: provider,
          items: [],
          error: `Unsupported provider type: ${provider.type}`,
        }
    }
  } catch (error) {
    return {
      source: provider,
      items: [],
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function runSources(providers = []) {
  const settled = await Promise.allSettled(
    providers.map((provider) => runSource(provider))
  )

  return settled.map((entry, index) => {
    if (entry.status === 'fulfilled') {
      return entry.value
    }

    return {
      source: providers[index],
      items: [],
      error: entry.reason instanceof Error ? entry.reason.message : String(entry.reason),
    }
  })
}
