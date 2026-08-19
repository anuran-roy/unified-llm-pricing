import { Overview } from "@/components/overview"
import { ssrGet } from "@/lib/ssr"
import type { StatsResponse } from "@/lib/api"

export const dynamic = "force-dynamic"

export default async function Page() {
  const stats = await ssrGet<StatsResponse>("/api/stats")

  return <Overview stats={stats} />
}