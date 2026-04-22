import { ingestDeals } from '@/lib/pipeline/ingest'

export async function POST(request) {
  const body = await request.json().catch(() => ({}))

  if (process.env.CRON_SECRET && body?.secret !== process.env.CRON_SECRET) {
    return new Response('Unauthorized', { status: 401 })
  }

  try {
    const result = await ingestDeals({ triggerType: 'manual' })
    return Response.json(result)
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: String(error),
      },
      { status: 500 }
    )
  }
}
