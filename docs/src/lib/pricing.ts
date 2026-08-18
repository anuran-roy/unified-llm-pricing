import type { ModelPricing, PricingData, Price } from "./types";

export const TOKEN_MODALITIES = ["text", "audio", "image", "video", "embedding"] as const;
export type TokenModality = (typeof TOKEN_MODALITIES)[number];

export function usdPerMillion(price: Price): number | null {
  if (price.currency !== "USD" || price.pricingType !== "token") return null;
  if (price.amount <= 0) return null;
  return (price.amount * 1_000_000) / price.units;
}

export function pickTokenPrice(prices: Price[]): Price | null {
  const tokens = prices.filter((p) => p.pricingType === "token");
  if (tokens.length === 0) return null;
  return tokens.find((p) => p.modality === "text") ?? tokens[0];
}

export function fmtUsd(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(n);
}

export function tierModalities(tier: {
  input: Price[];
  output: Price[];
  cacheRead: Price[];
  cacheWrite: Price[];
}): string {
  const set = new Set<string>();
  for (const arr of [tier.input, tier.output, tier.cacheRead, tier.cacheWrite]) {
    for (const p of arr) {
      if (p.pricingType === "token" && p.modality) set.add(p.modality);
    }
  }
  if (set.size === 0) return "text";
  return [...set].sort().join("+");
}

export interface ModelRow {
  provider: string;
  modelId: string;
  modelName: string;
  tier: string;
  modality: string;
  input: number | null;
  output: number | null;
  cacheRead: number | null;
  cacheWrite: number | null;
}

export function buildRows(data: PricingData): ModelRow[] {
  const rows: ModelRow[] = [];
  for (const provider of data.providers) {
    for (const model of provider.models) {
      for (const tier of model.tiers) {
        const input = pickTokenPrice(tier.input);
        const output = pickTokenPrice(tier.output);
        const cacheRead = pickTokenPrice(tier.cacheRead);
        const cacheWrite = pickTokenPrice(tier.cacheWrite);
        if (!input && !output && !cacheRead && !cacheWrite) continue;
        rows.push({
          provider: provider.provider,
          modelId: model.id,
          modelName: model.name,
          tier: tier.name,
          modality: tierModalities(tier),
          input: input ? usdPerMillion(input) : null,
          output: output ? usdPerMillion(output) : null,
          cacheRead: cacheRead ? usdPerMillion(cacheRead) : null,
          cacheWrite: cacheWrite ? usdPerMillion(cacheWrite) : null,
        });
      }
    }
  }
  return rows;
}

export interface TierComparisonRow {
  provider: string;
  modelId: string;
  modelName: string;
  standardTier: string;
  tier: string;
  input: number | null;
  output: number | null;
  standardInput: number | null;
  standardOutput: number | null;
  savingsPct: number | null;
}

const DISCOUNT_TIERS = ["batch", "flex", "fast", "priority", "async", "batch24h", "realtime"];

export function buildTierComparison(data: PricingData): TierComparisonRow[] {
  const rows: TierComparisonRow[] = [];
  for (const provider of data.providers) {
    for (const model of provider.models) {
      const standard = model.tiers.find((t) => t.name === "standard") ?? model.tiers[0];
      if (!standard) continue;
      const standardInputPrice = pickTokenPrice(standard.input);
      const standardOutputPrice = pickTokenPrice(standard.output);
      const standardInput = standardInputPrice ? usdPerMillion(standardInputPrice) : null;
      const standardOutput = standardOutputPrice ? usdPerMillion(standardOutputPrice) : null;
      for (const tier of model.tiers) {
        if (tier.name === standard.name) continue;
        if (!DISCOUNT_TIERS.includes(tier.name)) continue;
        const inputPrice = pickTokenPrice(tier.input);
        const outputPrice = pickTokenPrice(tier.output);
        const input = inputPrice ? usdPerMillion(inputPrice) : null;
        const output = outputPrice ? usdPerMillion(outputPrice) : null;
        if (input === null && output === null) continue;
        const savingsPct =
          standardInput !== null && input !== null ? ((standardInput - input) / standardInput) * 100 : null;
        rows.push({
          provider: provider.provider,
          modelId: model.id,
          modelName: model.name,
          standardTier: standard.name,
          tier: tier.name,
          input,
          output,
          standardInput,
          standardOutput,
          savingsPct,
        });
      }
    }
  }
  return rows;
}

export interface ProviderStat {
  provider: string;
  modelCount: number;
  cheapestInput: number | null;
  cheapestModel: string | null;
  avgStandardInput: number | null;
}

export interface OverviewStats {
  providerCount: number;
  modelCount: number;
  multiProviderModelCount: number;
  cheapestOverall: { model: string; provider: string; price: number } | null;
  medianStandardInput: number | null;
  perProvider: ProviderStat[];
  modalityCounts: Record<string, number>;
  tierCounts: Record<string, number>;
}

export function computeStats(data: PricingData): OverviewStats {
  const perProvider: ProviderStat[] = [];
  const modalityCounts: Record<string, number> = {};
  const tierCounts: Record<string, number> = {};
  const standardInputs: number[] = [];
  let cheapestOverall: { model: string; provider: string; price: number } | null = null;

  for (const provider of data.providers) {
    let cheapestInput: number | null = null;
    let cheapestModel: string | null = null;
    const inputs: number[] = [];
    for (const model of provider.models) {
      const modalities = new Set<string>();
      for (const tier of model.tiers) {
        tierCounts[tier.name] = (tierCounts[tier.name] ?? 0) + 1;
        for (const arr of [tier.input, tier.output, tier.cacheRead, tier.cacheWrite]) {
          for (const p of arr) {
            if (p.pricingType === "token" && p.modality) modalities.add(p.modality);
            if (tier.name === "standard" || model.tiers.length === 1) {
              const v = usdPerMillion(p);
              if (v !== null && p.pricingType === "token") inputs.push(v);
            }
          }
        }
        const inputPrice = pickTokenPrice(tier.input);
        const v = inputPrice ? usdPerMillion(inputPrice) : null;
        if (v !== null && (cheapestInput === null || v < cheapestInput)) {
          cheapestInput = v;
          cheapestModel = model.name;
        }
      }
      for (const m of modalities) modalityCounts[m] = (modalityCounts[m] ?? 0) + 1;
    }
    if (cheapestInput !== null) {
      standardInputs.push(...inputs);
      if (!cheapestOverall || cheapestInput < cheapestOverall.price) {
        cheapestOverall = { model: cheapestModel ?? "", provider: provider.provider, price: cheapestInput };
      }
    }
    const sorted = [...inputs].sort((a, b) => a - b);
    perProvider.push({
      provider: provider.provider,
      modelCount: provider.models.length,
      cheapestInput,
      cheapestModel,
      avgStandardInput: sorted.length ? sorted.reduce((a, b) => a + b, 0) / sorted.length : null,
    });
  }

  const sortedAll = [...standardInputs].sort((a, b) => a - b);
  const median =
    sortedAll.length > 0
      ? sortedAll.length % 2 === 1
        ? sortedAll[Math.floor(sortedAll.length / 2)]
        : (sortedAll[sortedAll.length / 2 - 1] + sortedAll[sortedAll.length / 2]) / 2
      : null;

  return {
    providerCount: data.providers.length,
    modelCount: data.providers.reduce((acc, p) => acc + p.models.length, 0),
    multiProviderModelCount: 0,
    cheapestOverall,
    medianStandardInput: median,
    perProvider,
    modalityCounts,
    tierCounts,
  };
}

export function getStandardTier(model: ModelPricing) {
  return model.tiers.find((t) => t.name === "standard") ?? model.tiers[0] ?? null;
}

export function modelInputPrice(model: ModelPricing): number | null {
  const tier = getStandardTier(model);
  if (!tier) return null;
  const p = pickTokenPrice(tier.input);
  return p ? usdPerMillion(p) : null;
}