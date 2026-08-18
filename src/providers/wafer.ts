import type {
  ModelPricing,
  Price,
  PricingTier,
  ProviderPricing,
} from "../types";

const URL =
  "https://pass.wafer.ai/v1/models";

const PROVIDER = "wafer";

interface WaferPricing {
  currency?: string;

  /*
   * Cents per 1M tokens.
   */
  input_cents_per_million?: number;
  output_cents_per_million?: number;
  cache_read_cents_per_million?: number;
}

interface WaferModel {
  id?: string;

  owned_by?: string;
  max_model_len?: number;
  zdr_supported?: boolean;

  wafer?: {
    display_name?: string;
    description?: string;
    tier?: string;
    context_length?: number;
    max_output_tokens?: number | null;
    pricing?: WaferPricing;

    capabilities?: Record<
      string,
      unknown
    >;
  };

  [key: string]: unknown;
}

interface WaferModelsResponse {
  data: WaferModel[];
}

/**
 * Wafer prices token costs in cents per 1M
 * tokens.
 *
 * We normalize:
 *
 *   126
 *
 * into:
 *
 *   $1.26 / 1M tokens
 */
function tokenPrice(
  centsPerMillion: number,
  raw: string,
): Price {
  return {
    amount:
      centsPerMillion / 100,
    currency: "USD",
    units: 1_000_000,
    pricingType: "token",
    modality: "text",
    raw,
  };
}

function normalizeModel(
  model: WaferModel,
): ModelPricing | undefined {
  const pricing =
    model.wafer?.pricing;

  if (!pricing) {
    return undefined;
  }

  const tier: PricingTier = {
    name: "standard",
    input: [],
    output: [],
    cacheRead: [],
    cacheWrite: [],
    other: [],
  };

  if (
    typeof pricing.input_cents_per_million ===
    "number"
  ) {
    tier.input?.push(
      tokenPrice(
        pricing.input_cents_per_million,
        String(
          pricing.input_cents_per_million,
        ) + " cents/1M",
      ),
    );
  }

  if (
    typeof pricing.output_cents_per_million ===
    "number"
  ) {
    tier.output?.push(
      tokenPrice(
        pricing.output_cents_per_million,
        String(
          pricing.output_cents_per_million,
        ) + " cents/1M",
      ),
    );
  }

  if (
    typeof pricing.cache_read_cents_per_million ===
    "number"
  ) {
    tier.cacheRead?.push(
      tokenPrice(
        pricing.cache_read_cents_per_million,
        String(
          pricing.cache_read_cents_per_million,
        ) + " cents/1M",
      ),
    );
  }

  return {
    id: model.id ?? "unknown",
    name:
      model.wafer?.display_name ??
      model.id,
    provider: PROVIDER,
    tiers: [tier],
    metadata: {
      source: "wafer",
      description:
        model.wafer?.description,
      tier: model.wafer?.tier,
      contextLength:
        model.wafer?.context_length ??
        model.max_model_len,
      maxOutputTokens:
        model.wafer?.max_output_tokens,
      zdrSupported:
        model.zdr_supported,
      ownedBy:
        model.owned_by,
      capabilities:
        model.wafer?.capabilities,
    },
  };
}

export async function getWaferPricing():
  Promise<ProviderPricing> {
  const response = await fetch(URL, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(
      `Wafer models request failed: ` +
      `${response.status} ${response.statusText}`,
    );
  }

  const result =
    (await response.json()) as WaferModelsResponse;

  const models: ModelPricing[] = [];

  for (const model of result.data ?? []) {
    const normalized =
      normalizeModel(model);

    if (normalized) {
      models.push(normalized);
    }
  }

  if (models.length === 0) {
    throw new Error(
      "Wafer parser extracted zero models. " +
      "The Wafer model page structure may have changed.",
    );
  }

  return {
    provider: PROVIDER,
    source: {
      url: URL,
      fetchedAt:
        new Date().toISOString(),
    },
    models,
  };
}