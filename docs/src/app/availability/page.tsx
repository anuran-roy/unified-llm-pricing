import { AvailabilityTable } from "@/components/availability-table"
import { ssrGet } from "@/lib/ssr"
import type { AvailabilityResponse } from "@/lib/api"

export const dynamic = "force-dynamic"

export default async function Page() {
  const availability = await ssrGet<AvailabilityResponse>("/api/availability", {
    minProviders: 2,
  })

  return <AvailabilityTable initial={availability} />
}