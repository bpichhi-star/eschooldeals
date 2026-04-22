import { ingestDeals } from '@/lib/pipeline/ingest'

export async function GET(request) {
  const authHeader = request.headers.get('authorization')
  const expectedSecret = process.env.CRON_SECRET
  const receivedSecret = authHeader?.replace('Bearer ', '')

  if (expectedSecret && receivedSecret !== expectedSecret) {
    return new Response('Unauthorized', { status: 401 })
  }

  try {
    const result = await ingestDeals({ triggerType: 'cron' })

    return Response.json({
      ok: true,
      triggerType: 'cron',
      ...result,
    })
  } catch (error) {
    return Response.json(
      {
        ok: false,
        triggerType: 'cron',
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
