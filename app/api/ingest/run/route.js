import { ingestDeals } from '@/lib/pipeline/ingest'

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

export async function GET() {
  try {
    return await runManualIngest()
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST() {
  try {
    return await runManualIngest()
  } catch (error) {
    return errorResponse(error)
  }
}
