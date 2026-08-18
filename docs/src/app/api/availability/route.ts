import { NextRequest } from "next/server"
import { getPricingData } from "@/lib/data"
import { parseAvailabilityQuery, queryAvailability } from "@/lib/leaderboard"
import type { AvailabilityResponse } from "@/lib/api"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const snapshot = await getPricingData()
  const q = parseAvailabilityQuery(request.nextUrl.searchParams)
  const { clusters, providers, total } = queryAvailability(snapshot.data, q)

  const body: AvailabilityResponse = {
    meta: {
      generatedAt: snapshot.data.generatedAt,
      fetchedAt: snapshot.fetchedAt,
      source: snapshot.source,
    },
    clusters,
    providers,
    total,
    minProviders: q.minProviders ?? 2,
  }
  return Response.json(body, {
    headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=3600" },
  })
}