export interface Price {
  amount: number;
  currency: string;
  pricingType: string;
  units: number;
  modality?: string;
  raw?: string;
}

export interface PricingTier {
  name: string;
  input: Price[];
  output: Price[];
  cacheRead: Price[];
  cacheWrite: Price[];
  other: Price[];
}

export interface ModelPricing {
  id: string;
  name: string;
  provider: string;
  tiers: PricingTier[];
  metadata?: Record<string, unknown>;
}

export interface ProviderPricing {
  provider: string;
  source: {
    url: string;
    fetchedAt: string;
  };
  models: ModelPricing[];
}

export interface PricingData {
  generatedAt: string;
  providers: ProviderPricing[];
}