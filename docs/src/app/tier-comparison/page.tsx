import { TierComparison } from "@/components/tier-comparison"
import { ssrGet } from "@/lib/ssr"
import type { TiersResponse } from "@/lib/api"

export const dynamic = "force-dynamic"

export default async function Page() {
  const tiers = await ssrGet<TiersResponse>("/api/tiers", {
    limit: 100,
    sortBy: "savings",
    sortOrder: "desc",
  })

  return <TierComparison initial={tiers} />
}