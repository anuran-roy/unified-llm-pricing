"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Overview } from "@/components/overview"
import { PriceTable } from "@/components/price-table"
import { AvailabilityTable } from "@/components/availability-table"
import { TierComparison } from "@/components/tier-comparison"
import type { AvailabilityResponse, LeaderboardResponse, StatsResponse, TiersResponse } from "@/lib/api"

export interface DashboardProps {
  leaderboard: LeaderboardResponse
  availability: AvailabilityResponse
  tiers: TiersResponse
  stats: StatsResponse
}

export function DashboardTabs(props: DashboardProps) {
  return (
    <Tabs defaultValue="overview">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="prices">Price per 1M tokens</TabsTrigger>
        <TabsTrigger value="availability">Availability</TabsTrigger>
        <TabsTrigger value="tiers">Tier comparison</TabsTrigger>
      </TabsList>
      <TabsContent value="overview">
        <Overview stats={props.stats} />
      </TabsContent>
      <TabsContent value="prices">
        <PriceTable initial={props.leaderboard} />
      </TabsContent>
      <TabsContent value="availability">
        <AvailabilityTable initial={props.availability} />
      </TabsContent>
      <TabsContent value="tiers">
        <TierComparison initial={props.tiers} />
      </TabsContent>
    </Tabs>
  )
}