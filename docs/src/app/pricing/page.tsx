import { PriceTable } from "@/components/price-table"
import { parseLeaderboardQuery } from "@/lib/leaderboard"
import { searchParamsToURLSearchParams, ssrGet } from "@/lib/ssr"
import type { LeaderboardResponse } from "@/lib/api"

export const dynamic = "force-dynamic"

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const query = parseLeaderboardQuery(searchParamsToURLSearchParams(await searchParams))
  const leaderboard = await ssrGet<LeaderboardResponse>("/api/leaderboard", {
    limit: 100,
    sortBy: query.sortBy,
    sortOrder: query.sortOrder,
    ...(query.models ? { models: query.models } : {}),
    ...(query.provider ? { provider: query.provider } : {}),
    ...(query.tier ? { tier: query.tier } : {}),
    ...(query.modality ? { modality: query.modality } : {}),
    ...(query.minSize !== undefined ? { minSize: String(query.minSize) } : {}),
    ...(query.maxSize !== undefined ? { maxSize: String(query.maxSize) } : {}),
  })

  return <PriceTable initial={leaderboard} initialQuery={query} />
}