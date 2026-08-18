import { NextRequest } from "next/server"
import { getPricingData } from "@/lib/data"
import { parseTiersQuery, queryTiers } from "@/lib/leaderboard"
import type { TiersResponse } from "@/lib/api"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const snapshot = await getPricingData()
  const q = parseTiersQuery(request.nextUrl.searchParams)
  const { rows, total, filters } = queryTiers(snapshot.data, q)

  const body: TiersResponse = {
    meta: {
      generatedAt: snapshot.data.generatedAt,
      fetchedAt: snapshot.fetchedAt,
      source: snapshot.source,
    },
    rows,
    total,
    limit: q.limit ?? 100,
    offset: q.offset ?? 0,
    filters,
  }
  return Response.json(body, {
    headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=3600" },
  })
}