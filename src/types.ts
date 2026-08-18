export type Provider = string;
export type PricingType = "token" | "image" | "audio" | "video" | "request" | "minute" | "hour" | "character" | string;
export type Modality = "text" | "image" | "audio" | "video" | "embedding" | string;
export interface Price { amount: number; currency: string; units?: number; pricingType: PricingType; modality?: Modality; raw?: string; }
export interface PricingTier { name: string; input?: Price[]; output?: Price[]; cacheRead?: Price[]; cacheWrite?: Price[]; other?: Price[]; metadata?: Record<string, unknown>; }
export interface ModelPricing {
  id: string;
  name?: string;

  provider: Provider;

  tiers: PricingTier[];

  metadata?: Record<string, unknown>;

  /**
   * Individual serving providers for aggregators
   * such as OpenRouter.
   */
  endpoints?: ModelEndpoint[];
}

export interface ModelEndpoint {
  provider: Provider;
  name?: string;

  tiers: PricingTier[];

  metadata?: Record<string, unknown>;
}export interface ProviderPricing { provider: Provider; source: { url: string; fetchedAt: string }; models: ModelPricing[]; }
export interface UnifiedPricing { generatedAt: string; providers: ProviderPricing[]; }
