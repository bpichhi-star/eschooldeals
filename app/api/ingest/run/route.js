import { ingestDeals } from '@/lib/pipeline/ingest'

function isAuthorized(providedSecret) {
  const expectedSecret = process.env.CRON_SECRET

  if (!expectedSecret) {
    return true
  }

  return providedSecret === expectedSecret
}

async function runManualIngest() {
  const result = await ingestDeals({ triggerType: 'manual' })

  return Response.json({
    ok: true,
    triggerType: 'manual',
    ...result,
  })
}

function errorResponse(error) {
  return Response.json(
    {
      ok: false,
      triggerType: 'manual',
      error: error instanceof Error ? error.message : String(error),
    },
    { status: 500 }
  )
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const providedSecret = searchParams.get('secret')

  if (!isAuthorized(providedSecret)) {
    return new Response('Unauthorized', { status: 401 })
  }

  try {
    return await runManualIngest()
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}))
  const providedSecret = body?.secret

  if (!isAuthorized(providedSecret)) {
    return new Response('Unauthorized', { status: 401 })
  }

  try {
    return await runManualIngest()
  } catch (error) {
    return errorResponse(error)
  }
}
