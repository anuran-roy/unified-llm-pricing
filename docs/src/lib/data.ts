import type { PricingData } from "./types";

export const REMOTE_URL =
  "https://raw.githubusercontent.com/anuran-roy/unified-llm-pricing/refs/heads/main/data/pricing.json";

export interface PricingSnapshot {
  data: PricingData;
  source: "remote";
  fetchedAt: string;
}

let cached: Promise<PricingSnapshot> | null = null;

async function load(): Promise<PricingSnapshot> {
  const res = await fetch(REMOTE_URL, {
    next: { revalidate: 3600 },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Failed to fetch pricing data: HTTP ${res.status}`);
  const data = (await res.json()) as PricingData;
  if (!data || !Array.isArray(data.providers)) throw new Error("Invalid payload shape");
  return { data, source: "remote", fetchedAt: new Date().toISOString() };
}

export function getPricingData(): Promise<PricingSnapshot> {
  if (!cached) cached = load();
  return cached;
}