import type { ModelPricing, PricingData, Price } from "./types";

export const TOKEN_MODALITIES = ["text", "audio", "image", "video", "embedding", "rerank"] as const;
export type TokenModality = (typeof TOKEN_MODALITIES)[number];

export function inferModality(model: ModelPricing): TokenModality | undefined {
  const mode = model.metadata?.mode;
  if (mode === "embedding" || model.metadata?.type === "Embedding") return "embedding";
  if (mode === "image_generation" || mode === "image_edit") return "image";
  if (mode === "video_generation") return "video";
  if (mode === "rerank") return "rerank";
  if (mode === "audio_transcription" || mode === "audio_speech" || mode === "text_to_speech") return "audio";

  const arch = model.metadata?.architecture as { modality?: string } | undefined;
  const output = arch?.modality?.split("->")[1] ?? "";
  const kinds = output
    .split("+")
    .map((k) => k.trim())
    .filter(Boolean);
  if (kinds.length === 1) {
    if (kinds[0] === "embeddings") return "embedding";
    if (kinds[0] === "rerank") return "rerank";
    if (kinds[0] === "image") return "image";
    if (kinds[0] === "video") return "video";
    if (kinds[0] === "audio" || kinds[0] === "speech" || kinds[0] === "transcription") return "audio";
  }

  const idName = `${model.id} ${model.name}`;
  if (/embed/i.test(idName)) return "embedding";
  if (/rerank/i.test(idName)) return "rerank";
  if (/imagen|\bimage\b/i.test(idName)) return "image";
  if (/\bsora\b|\bveo\b|video/i.test(idName)) return "video";
  if (/\blyria\b|tts|transcrib|whisper|audio/i.test(idName)) return "audio";
  return undefined;
}

export function effectiveModality(model: ModelPricing, price: Price): string {
  if (price.modality && price.modality !== "text") return price.modality;
  return inferModality(model) ?? price.modality ?? "text";
}

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

export function tierModalities(
  model: ModelPricing,
  tier: {
    input: Price[];
    output: Price[];
    cacheRead: Price[];
    cacheWrite: Price[];
  }
): string {
  const set = new Set<string>();
  for (const arr of [tier.input, tier.output, tier.cacheRead, tier.cacheWrite]) {
    for (const p of arr) {
      if (p.pricingType === "token") set.add(effectiveModality(model, p));
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
          modality: tierModalities(model, tier),
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
  avgByModality: Record<string, number | null>;
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
  modalities: string[];
}

export function computeStats(data: PricingData): OverviewStats {
  const perProvider: ProviderStat[] = [];
  const modalityCounts: Record<string, number> = {};
  const tierCounts: Record<string, number> = {};
  const standardInputs: number[] = [];
  const standardModalities = new Set<string>();
  let cheapestOverall: { model: string; provider: string; price: number } | null = null;

  for (const provider of data.providers) {
    let cheapestInput: number | null = null;
    let cheapestModel: string | null = null;
    const inputs: number[] = [];
    const inputsByModality: Record<string, number[]> = {};
    for (const model of provider.models) {
      const mainTier = getStandardTier(model);
      const modalities = new Set<string>();
      for (const tier of model.tiers) {
        tierCounts[tier.name] = (tierCounts[tier.name] ?? 0) + 1;
        for (const arr of [tier.input, tier.output, tier.cacheRead, tier.cacheWrite]) {
          for (const p of arr) {
            if (p.pricingType !== "token") continue;
            modalities.add(effectiveModality(model, p));
            if (tier === mainTier) {
              const v = usdPerMillion(p);
              if (v !== null) {
                inputs.push(v);
                const mod = effectiveModality(model, p);
                (inputsByModality[mod] ??= []).push(v);
                standardModalities.add(mod);
              }
            }
          }
        }
      }
      const inputPrice = mainTier ? pickTokenPrice(mainTier.input) : null;
      const v = inputPrice ? usdPerMillion(inputPrice) : null;
      if (v !== null && (cheapestInput === null || v < cheapestInput)) {
        cheapestInput = v;
        cheapestModel = model.name;
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
    const avgByModality: Record<string, number | null> = {};
    for (const [mod, vals] of Object.entries(inputsByModality)) {
      avgByModality[mod] = vals.reduce((a, b) => a + b, 0) / vals.length;
    }
    perProvider.push({
      provider: provider.provider,
      modelCount: provider.models.length,
      cheapestInput,
      cheapestModel,
      avgStandardInput: sorted.length ? sorted.reduce((a, b) => a + b, 0) / sorted.length : null,
      avgByModality,
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
    modalities: [...standardModalities].sort(),
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