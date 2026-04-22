import { getHomepageDeals } from '@/lib/queries/getHomepageDeals'

export async function GET() {
  const deals = await getHomepageDeals()
  return Response.json({ deals })
}
