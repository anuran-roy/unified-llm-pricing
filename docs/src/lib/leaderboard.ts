import type { PricingData } from "./types"
import { buildRows, buildTierComparison, computeStats, type ModelRow, type TierComparisonRow } from "./pricing"
import { buildAvailability } from "./normalize"

export const SORT_KEYS = ["input", "output", "cacheRead", "cacheWrite", "modelName", "provider", "tier", "modality"] as const
export type SortKey = (typeof SORT_KEYS)[number]

export interface LeaderboardQuery {
  models?: string
  provider?: string
  tier?: string
  modality?: string
  sortBy?: SortKey
  sortOrder?: "asc" | "desc"
  limit?: number
  offset?: number
}

function parseLimit(value: string | null, fallback: number, max: number): number {
  const n = value ? Number.parseInt(value, 10) : fallback
  if (!Number.isFinite(n) || n <= 0) return fallback
  return Math.min(n, max)
}

export function parseLeaderboardQuery(sp: URLSearchParams): LeaderboardQuery {
  const sortBy = sp.get("sortBy") as SortKey | null
  return {
    models: sp.get("models") ?? undefined,
    provider: sp.get("provider") ?? undefined,
    tier: sp.get("tier") ?? undefined,
    modality: sp.get("modality") ?? undefined,
    sortBy: sortBy && SORT_KEYS.includes(sortBy) ? sortBy : "input",
    sortOrder: sp.get("sortOrder") === "desc" ? "desc" : "asc",
    limit: parseLimit(sp.get("limit"), 100, 1000),
    offset: Math.max(parseLimit(sp.get("offset"), 0, 100_000), 0),
  }
}

export function queryLeaderboard(
  data: PricingData,
  q: LeaderboardQuery
): { rows: ModelRow[]; total: number; filters: import("./api").LeaderboardFilters } {
  const allRows = buildRows(data)
  let rows = allRows

  if (q.provider) rows = rows.filter((r) => r.provider === q.provider)
  if (q.tier) rows = rows.filter((r) => r.tier === q.tier)
  if (q.modality) rows = rows.filter((r) => r.modality.split("+").includes(q.modality!))
  if (q.models) {
    const needle = q.models.toLowerCase()
    rows = rows.filter(
      (r) => r.modelName.toLowerCase().includes(needle) || r.modelId.toLowerCase().includes(needle)
    )
  }

  const key = q.sortBy ?? "input"
  const dir = q.sortOrder === "desc" ? -1 : 1
  rows = [...rows].sort((a, b) => {
    const av = a[key] ?? (key === "modelName" ? a.modelName : key === "provider" ? a.provider : key === "tier" ? a.tier : key === "modality" ? a.modality : Number.POSITIVE_INFINITY)
    const bv = b[key] ?? (key === "modelName" ? b.modelName : key === "provider" ? b.provider : key === "tier" ? b.tier : key === "modality" ? b.modality : Number.POSITIVE_INFINITY)
    if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir
    return String(av).localeCompare(String(bv)) * dir
  })

  const filters: import("./api").LeaderboardFilters = {
    providers: [...new Set(allRows.map((r) => r.provider))].sort(),
    tiers: [...new Set(allRows.map((r) => r.tier))].sort(),
    modalities: [...new Set(allRows.flatMap((r) => r.modality.split("+")))].sort(),
  }

  const total = rows.length
  const offset = q.offset ?? 0
  const limit = q.limit ?? 100
  return { rows: rows.slice(offset, offset + limit), total, filters }
}

export interface AvailabilityQuery {
  models?: string
  provider?: string
  minProviders?: number
  sortBy?: "count" | "name" | "input"
  sortOrder?: "asc" | "desc"
  limit?: number
  offset?: number
}

export function parseAvailabilityQuery(sp: URLSearchParams): AvailabilityQuery {
  const sortBy = sp.get("sortBy")
  return {
    models: sp.get("models") ?? undefined,
    provider: sp.get("provider") ?? undefined,
    minProviders: Math.max(parseLimit(sp.get("minProviders"), 2, 20), 1),
    sortBy: sortBy === "name" || sortBy === "input" ? sortBy : "count",
    sortOrder: sp.get("sortOrder") === "asc" ? "asc" : "desc",
    limit: parseLimit(sp.get("limit"), 100, 1000),
    offset: Math.max(parseLimit(sp.get("offset"), 0, 100_000), 0),
  }
}

export function queryAvailability(
  data: PricingData,
  q: AvailabilityQuery
): { clusters: import("./api").AvailabilityCluster[]; providers: string[]; total: number } {
  let clusters = buildAvailability(data)

  if (q.provider) clusters = clusters.filter((c) => c.entries.some((e) => e.provider === q.provider))
  if (q.models) {
    const needle = q.models.toLowerCase()
    clusters = clusters.filter(
      (c) => c.displayName.toLowerCase().includes(needle) || c.key.includes(needle)
    )
  }
  clusters = clusters.filter((c) => c.count >= (q.minProviders ?? 2))

  const dir = q.sortOrder === "asc" ? 1 : -1
  clusters = [...clusters].sort((a, b) => {
    if (q.sortBy === "name") return a.displayName.localeCompare(b.displayName) * dir
    if (q.sortBy === "input") {
      const amin = Math.min(...a.entries.map((e) => e.input ?? Number.POSITIVE_INFINITY))
      const bmin = Math.min(...b.entries.map((e) => e.input ?? Number.POSITIVE_INFINITY))
      return (amin - bmin) * dir
    }
    return (a.count - b.count) * dir
  })

  const providerSet = new Set<string>()
  for (const c of clusters) for (const e of c.entries) providerSet.add(e.provider)
  const providers = [...providerSet].sort()

  const total = clusters.length
  const offset = q.offset ?? 0
  const limit = q.limit ?? 100
  return { clusters: clusters.slice(offset, offset + limit), providers, total }
}

export interface TiersQuery {
  models?: string
  provider?: string
  sortBy?: "savings" | "input" | "output" | "modelName"
  sortOrder?: "asc" | "desc"
  limit?: number
  offset?: number
}

export function parseTiersQuery(sp: URLSearchParams): TiersQuery {
  const sortBy = sp.get("sortBy")
  return {
    models: sp.get("models") ?? undefined,
    provider: sp.get("provider") ?? undefined,
    sortBy: sortBy === "input" || sortBy === "output" || sortBy === "modelName" ? sortBy : "savings",
    sortOrder: sp.get("sortOrder") === "asc" ? "asc" : "desc",
    limit: parseLimit(sp.get("limit"), 100, 1000),
    offset: Math.max(parseLimit(sp.get("offset"), 0, 100_000), 0),
  }
}

export function queryTiers(
  data: PricingData,
  q: TiersQuery
): { rows: TierComparisonRow[]; total: number; filters: import("./api").LeaderboardFilters } {
  const allRows = buildTierComparison(data)
  let rows = allRows

  if (q.provider) rows = rows.filter((r) => r.provider === q.provider)
  if (q.models) {
    const needle = q.models.toLowerCase()
    rows = rows.filter((r) => r.modelName.toLowerCase().includes(needle) || r.modelId.toLowerCase().includes(needle))
  }

  const dir = q.sortOrder === "asc" ? 1 : -1
  rows = [...rows].sort((a, b) => {
    if (q.sortBy === "modelName") return a.modelName.localeCompare(b.modelName) * dir
    const av = a[q.sortBy === "input" ? "input" : q.sortBy === "output" ? "output" : "savingsPct"]
    const bv = b[q.sortBy === "input" ? "input" : q.sortBy === "output" ? "output" : "savingsPct"]
    const an = av ?? Number.NEGATIVE_INFINITY
    const bn = bv ?? Number.NEGATIVE_INFINITY
    return (an - bn) * dir
  })

  const filters: import("./api").LeaderboardFilters = {
    providers: [...new Set(allRows.map((r) => r.provider))].sort(),
    tiers: [...new Set(allRows.map((r) => r.tier))].sort(),
    modalities: [],
  }

  const total = rows.length
  const offset = q.offset ?? 0
  const limit = q.limit ?? 100
  return { rows: rows.slice(offset, offset + limit), total, filters }
}

export function buildStats(data: PricingData) {
  const stats = computeStats(data)
  const clusters = buildAvailability(data)
  stats.multiProviderModelCount = clusters.filter((c) => c.count >= 2).length
  return stats
}