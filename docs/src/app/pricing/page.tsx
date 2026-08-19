import { PriceTable } from "@/components/price-table"
import { ssrGet } from "@/lib/ssr"
import type { LeaderboardResponse } from "@/lib/api"

export const dynamic = "force-dynamic"

export default async function Page() {
  const leaderboard = await ssrGet<LeaderboardResponse>("/api/leaderboard", {
    limit: 100,
    sortBy: "input",
    sortOrder: "asc",
  })

  return <PriceTable initial={leaderboard} />
}