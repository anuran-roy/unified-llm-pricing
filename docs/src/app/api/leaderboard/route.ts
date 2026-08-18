import { NextRequest } from "next/server"
import { getPricingData } from "@/lib/data"
import { parseLeaderboardQuery, queryLeaderboard } from "@/lib/leaderboard"
import type { LeaderboardResponse } from "@/lib/api"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const snapshot = await getPricingData()
  const q = parseLeaderboardQuery(request.nextUrl.searchParams)
  const { rows, total, filters } = queryLeaderboard(snapshot.data, q)

  const body: LeaderboardResponse = {
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