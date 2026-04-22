import { ingestDeals } from '@/lib/pipeline/ingest'

export async function GET(request) {
  const authHeader = request.headers.get('authorization')
  const expected = process.env.CRON_SECRET
  const received = authHeader?.replace('Bearer ', '')

  if (expected && received !== expected) {
    return new Response('Unauthorized', { status: 401 })
  }

  try {
    const result = await ingestDeals({ triggerType: 'cron' })
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
