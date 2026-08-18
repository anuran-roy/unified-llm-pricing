import type {
  ModelPricing,
  Price,
  PricingTier,
  ProviderPricing,
} from "../types.js";

const URL =
  "https://docs.doubleword.ai/api/models";

const PROVIDER =
  "doubleword";

interface DoublewordPricing {
  async?: {
    input?: number;
    output?: number;
  };

  batch24h?: {
    input?: number;
    output?: number;
  };

  realtime?: {
    input?: number;
    output?: number;
  } | null;
}

interface DoublewordCachePricing {
  enabled: boolean;

  readMultiplier:
    | number
    | null;

  writeMultiplier5m:
    | number
    | null;

  writeMultiplier1h:
    | number
    | null;

  writeMultiplier24h:
    | number
    | null;

  minPrefixTokens:
    | number
    | null;

  validFrom:
    | string
    | null;

  validUntil:
    | string
    | null;
}

interface DoublewordModel {
  id: string;
  name: string;
  displayName?: string;
  providerName?: string;

  description?: string;

  type?: string;

  capabilities?: string[];

  pricing: DoublewordPricing;

  cachePricing?: DoublewordCachePricing;
}

function tokenPrice(
  dollarsPerToken:
    | number
    | undefined,
): Price | undefined {
  if (
    dollarsPerToken === undefined ||
    !Number.isFinite(
      dollarsPerToken,
    )
  ) {
    return undefined;
  }

  return {
    /*
     * Doubleword gives us $/token.
     *
     * Convert to $/1M tokens.
     */
    amount:
      dollarsPerToken *
      1_000_000,

    currency: "USD",

    units: 1_000_000,

    pricingType: "token",

    modality: "text",
  };
}

function addTier(
  model: ModelPricing,
  name: string,
  pricing:
    | {
        input?: number;
        output?: number;
      }
    | undefined,
) {
  if (!pricing) {
    return;
  }

  const tier: PricingTier = {
    name,
    input: [],
    output: [],
    cacheRead: [],
    cacheWrite: [],
    other: [],
  };

  const input =
    tokenPrice(pricing.input);

  const output =
    tokenPrice(pricing.output);

  if (input) {
    tier.input?.push(input);
  }

  if (output) {
    tier.output?.push(output);
  }

  /*
   * Don't create an empty tier.
   */
  if (
    !tier.input?.length &&
    !tier.output?.length
  ) {
    return;
  }

  model.tiers.push(tier);
}

function parseModel(
  source: DoublewordModel,
): ModelPricing {
  const model: ModelPricing = {
    id: source.id,

    name:
      source.displayName ??
      source.name,

    provider: PROVIDER,

    tiers: [],

    metadata: {
      providerName:
        source.providerName,

      type:
        source.type,

      capabilities:
        source.capabilities,

      description:
        source.description,
    },
  };

  addTier(
    model,
    "async",
    source.pricing.async,
  );

  addTier(
    model,
    "batch24h",
    source.pricing.batch24h,
  );

  addTier(
    model,
    "realtime",
    source.pricing.realtime ??
      undefined,
  );

  /*
   * Doubleword exposes cache pricing as
   * multipliers against the base input price.
   *
   * Keep these as metadata rather than pretending
   * they are absolute prices.
   */
  if (
    source.cachePricing?.enabled
  ) {
    model.metadata ??= {};

    model.metadata.cachePricing = {
      enabled: true,

      readMultiplier:
        source.cachePricing
          .readMultiplier,

      writeMultiplier5m:
        source.cachePricing
          .writeMultiplier5m,

      writeMultiplier1h:
        source.cachePricing
          .writeMultiplier1h,

      writeMultiplier24h:
        source.cachePricing
          .writeMultiplier24h,

      minPrefixTokens:
        source.cachePricing
          .minPrefixTokens,

      validFrom:
        source.cachePricing
          .validFrom,

      validUntil:
        source.cachePricing
          .validUntil,
    };
  }

  return model;
}

export async function getDoublewordPricing():
  Promise<ProviderPricing> {
  const response =
    await fetch(URL, {
      headers: {
        "User-Agent":
          "unified-llm-pricing/1.0",
        Accept:
          "application/json",
      },
    });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch Doubleword models: ` +
      `${response.status} ${response.statusText}`,
    );
  }

  const data =
    (await response.json()) as {
      models?: DoublewordModel[];
    };

  if (
    !data.models ||
    !Array.isArray(
      data.models,
    )
  ) {
    throw new Error(
      "Doubleword response does not contain a models array.",
    );
  }

  const models =
    data.models.map(parseModel);

  if (models.length === 0) {
    throw new Error(
      "Doubleword returned zero models.",
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