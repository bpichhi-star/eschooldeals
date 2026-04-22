import { normalizeDeal } from '@/lib/pipeline/normalize'
import { scoreDeal } from '@/lib/pipeline/score'
import { dedupeDeals } from '@/lib/pipeline/dedupe'
import { filterValidDeals } from '@/lib/pipeline/validate'
import { loadProviders } from '@/lib/sources/registry'
import { runSources } from '@/lib/sources/runner'
import { createRun, finishRun, saveRawDeals, upsertDeals } from '@/lib/queries/saveDeals'

export async function ingestDeals({ triggerType = 'manual' } = {}) {
  const runId = await createRun(triggerType)

  try {
    const providers = await loadProviders()
    const sourceResults = await runSources(providers)

    for (const result of sourceResults) {
      await saveRawDeals(runId, result.source.key, result.items)
    }

    const allRawDeals = sourceResults.flatMap((result) =>
      result.items.map((item) => ({
        ...item,
        source_key: item.source_key || result.source.key,
        source_type: item.source_type || result.source.type,
      }))
    )

    const normalizedDeals = allRawDeals.map(normalizeDeal)
    const validDeals = filterValidDeals(normalizedDeals)
    const scoredDeals = validDeals.map((deal) => ({
      ...deal,
      score: scoreDeal(deal),
    }))
    const dedupedDeals = dedupeDeals(scoredDeals)

    await upsertDeals(dedupedDeals)
    await finishRun(runId, 'success', `Processed ${dedupedDeals.length} deals`)

    return {
      ok: true,
      runId,
      providers: providers.length,
      rawCount: allRawDeals.length,
      validCount: validDeals.length,
      finalCount: dedupedDeals.length,
    }
  } catch (error) {
    await finishRun(runId, 'failed', String(error))
    throw error
  }
}
