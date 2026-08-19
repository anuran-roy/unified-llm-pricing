import { AvailabilityTable } from "@/components/availability-table"
import { parseAvailabilityQuery } from "@/lib/leaderboard"
import { searchParamsToURLSearchParams, ssrGet } from "@/lib/ssr"
import type { AvailabilityResponse } from "@/lib/api"

export const dynamic = "force-dynamic"

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const query = parseAvailabilityQuery(searchParamsToURLSearchParams(await searchParams))
  const availability = await ssrGet<AvailabilityResponse>("/api/availability", {
    minProviders: String(query.minProviders ?? 2),
    ...(query.models ? { models: query.models } : {}),
    ...(query.providers ? { providers: query.providers } : {}),
  })

  return <AvailabilityTable initial={availability} initialQuery={query} />
}