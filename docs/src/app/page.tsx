import { DashboardTabs } from "@/components/dashboard-tabs"
import { ssrGet } from "@/lib/ssr"
import type { AvailabilityResponse, LeaderboardResponse, StatsResponse, TiersResponse } from "@/lib/api"

export const dynamic = "force-dynamic"

export default async function Page() {
  const [leaderboard, availability, tiers, stats] = await Promise.all([
    ssrGet<LeaderboardResponse>("/api/leaderboard", { limit: 100, sortBy: "input", sortOrder: "asc" }),
    ssrGet<AvailabilityResponse>("/api/availability", { minProviders: 2 }),
    ssrGet<TiersResponse>("/api/tiers", { limit: 100, sortBy: "savings", sortOrder: "desc" }),
    ssrGet<StatsResponse>("/api/stats"),
  ])

  return (
    <DashboardTabs
      leaderboard={leaderboard}
      availability={availability}
      tiers={tiers}
      stats={stats}
    />
  )
}