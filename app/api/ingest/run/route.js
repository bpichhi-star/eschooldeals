import { ingestDeals } from '@/lib/pipeline/ingest'

export async function POST(request) {
  const body = await request.json().catch(() => ({}))

  const expectedSecret = process.env.CRON_SECRET
  const providedSecret = body?.secret

  if (expectedSecret && providedSecret !== expectedSecret) {
    return new Response('Unauthorized', { status: 401 })
  }

  try {
    const result = await ingestDeals({ triggerType: 'manual' })

    return Response.json({
      ok: true,
      triggerType: 'manual',
      ...result,
    })
  } catch (error) {
    return Response.json(
      {
        ok: false,
        triggerType: 'manual',
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
