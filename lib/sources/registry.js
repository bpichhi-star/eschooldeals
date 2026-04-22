import providers from '@/lib/sources/providers/merchants.json'

export async function loadProviders() {
  if (!Array.isArray(providers)) {
    return []
  }

  return providers.filter((provider) => provider && provider.enabled !== false)
}
