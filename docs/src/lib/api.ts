export type DataSource = "remote"

export interface ApiMeta {
  generatedAt: string
  fetchedAt: string
  source: DataSource
  error?: string
}

export interface LeaderboardFilters {
  providers: string[]
  tiers: string[]
  modalities: string[]
  sizeRange: { min: number; max: number } | null
}

export interface LeaderboardResponse {
  meta: ApiMeta
  rows: LeaderboardRow[]
  total: number
  limit: number
  offset: number
  filters: LeaderboardFilters
}

export interface LeaderboardRow {
  provider: string
  modelId: string
  modelName: string
  tier: string
  modality: string
  sizeB: number | null
  input: number | null
  output: number | null
  cacheRead: number | null
  cacheWrite: number | null
}

export interface AvailabilityResponse {
  meta: ApiMeta
  clusters: AvailabilityCluster[]
  providers: string[]
  total: number
  minProviders: number
}

export interface AvailabilityCluster {
  key: string
  displayName: string
  count: number
  entries: AvailabilityEntry[]
}

export interface AvailabilityEntry {
  provider: string
  modelId: string
  modelName: string
  input: number | null
  output: number | null
  cacheRead: number | null
  cacheWrite: number | null
}

export interface TiersResponse {
  meta: ApiMeta
  rows: TierRow[]
  total: number
  limit: number
  offset: number
  filters: LeaderboardFilters
}

export interface TierRow {
  provider: string
  modelId: string
  modelName: string
  standardTier: string
  tier: string
  input: number | null
  output: number | null
  standardInput: number | null
  standardOutput: number | null
  savingsPct: number | null
}

export interface StatsResponse {
  meta: ApiMeta
  stats: OverviewStats
}

export interface ProviderStat {
  provider: string
  modelCount: number
  cheapestInput: number | null
  cheapestModel: string | null
  avgStandardInput: number | null
  avgByModality: Record<string, number | null>
}

export interface OverviewStats {
  providerCount: number
  modelCount: number
  multiProviderModelCount: number
  cheapestOverall: { model: string; provider: string; price: number } | null
  medianStandardInput: number | null
  perProvider: ProviderStat[]
  modalityCounts: Record<string, number>
  tierCounts: Record<string, number>
  modalities: string[]
}