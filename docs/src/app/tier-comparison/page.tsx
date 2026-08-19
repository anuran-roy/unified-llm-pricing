import { TierComparison } from "@/components/tier-comparison"
import { parseTiersQuery } from "@/lib/leaderboard"
import { searchParamsToURLSearchParams, ssrGet } from "@/lib/ssr"
import type { TiersResponse } from "@/lib/api"

export const dynamic = "force-dynamic"

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const query = parseTiersQuery(searchParamsToURLSearchParams(await searchParams))
  const tiers = await ssrGet<TiersResponse>("/api/tiers", {
    limit: 100,
    sortBy: query.sortBy,
    sortOrder: query.sortOrder,
    ...(query.models ? { models: query.models } : {}),
    ...(query.provider ? { provider: query.provider } : {}),
  })

  return <TierComparison initial={tiers} initialQuery={query} />
}