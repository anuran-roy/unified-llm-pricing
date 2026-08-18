import { getPricingData } from "@/lib/data"
import { buildStats } from "@/lib/leaderboard"
import type { StatsResponse } from "@/lib/api"

export const dynamic = "force-dynamic"

export async function GET() {
  const snapshot = await getPricingData()
  const stats = buildStats(snapshot.data)

  const body: StatsResponse = {
    meta: {
      generatedAt: snapshot.data.generatedAt,
      fetchedAt: snapshot.fetchedAt,
      source: snapshot.source,
    },
    stats,
  }
  return Response.json(body, {
    headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=3600" },
  })
}