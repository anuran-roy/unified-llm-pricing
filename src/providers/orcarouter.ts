import type {
  ModelPricing,
  Price,
  PricingTier,
  ProviderPricing,
} from "../types.js";

import { inferModelModality } from "../utils/modality.js";

const URL =
  "https://api.orcarouter.ai/v1/models";

const PROVIDER = "orcarouter";

interface OrcaRouterModel {
  id: string;
  name?: string;
  description?: string;
  context_length?: number;
  architecture?: {
    input_modalities?: string[] | null;
    output_modalities?: string[] | null;
  };
  pricing?: {
    prompt?: string;
    completion?: string;
    request?: string;
    request_unit?: string;
  };
}

function tokenPrice(
  value: string | undefined,
  modality: Price["modality"],
): Price | undefined {
  if (
    value === undefined ||
    value === ""
  ) {
    return undefined;
  }

  const amount =
    Number.parseFloat(value);

  if (
    !Number.isFinite(amount) ||
    amount <= 0
  ) {
    return undefined;
  }

  return {
    amount,
    currency: "USD",
    units: 1,
    pricingType: "token",
    modality,
    raw: value,
  };
}

function requestPrice(
  model: OrcaRouterModel,
  modality: Price["modality"],
): Price | undefined {
  const value =
    model.pricing?.request;

  if (
    value === undefined ||
    value === ""
  ) {
    return undefined;
  }

  const amount =
    Number.parseFloat(value);

  if (
    !Number.isFinite(amount) ||
    amount <= 0
  ) {
    return undefined;
  }

  const unit =
    model.pricing?.request_unit;

  return {
    amount,
    currency: "USD",
    units: 1,
    pricingType:
      unit === "second"
        ? "second"
        : unit === "minute"
          ? "minute"
          : "request",
    modality,
    raw:
      unit
        ? `${value} per ${unit}`
        : value,
  };
}

function normalizeModel(
  model: OrcaRouterModel,
): ModelPricing {
  const modality: Price["modality"] =
    inferModelModality(model) ??
    "text";

  const tier: PricingTier = {
    name: "default",
    input: [],
    output: [],
    cacheRead: [],
    cacheWrite: [],
    other: [],
  };

  const prompt = tokenPrice(
    model.pricing?.prompt,
    modality,
  );

  if (prompt) {
    tier.input!.push(prompt);
  }

  const completion = tokenPrice(
    model.pricing?.completion,
    modality,
  );

  if (completion) {
    tier.output!.push(completion);
  }

  const perRequest = requestPrice(
    model,
    modality,
  );

  if (perRequest) {
    tier.other!.push(perRequest);
  }

  const pricing: ModelPricing = {
    id: model.id,
    name:
      model.name ??
      model.id,
    provider: PROVIDER,
    tiers: [tier],
  };

  if (
    model.context_length ||
    model.description ||
    model.architecture
  ) {
    pricing.metadata = {};

    if (model.context_length) {
      pricing.metadata.contextLength =
        model.context_length;
    }

    if (model.description) {
      pricing.metadata.description =
        model.description;
    }

    if (model.architecture) {
      pricing.metadata.architecture =
        model.architecture;
    }
  }

  return pricing;
}

/**
 * Fetch all models from OrcaRouter.
 */
async function fetchOrcaRouterModels(): Promise<OrcaRouterModel[]> {
  const response = await fetch(URL, {
    headers: {
      "User-Agent":
        "unified-llm-pricing/1.0",
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(
      `OrcaRouter models request failed: ` +
        `${response.status} ${response.statusText}`,
    );
  }

  const payload =
    (await response.json()) as {
      data: OrcaRouterModel[];
    };

  return payload.data;
}

export async function getOrcaRouterPricing():
  Promise<ProviderPricing> {
  const models =
    await fetchOrcaRouterModels();

  if (models.length === 0) {
    throw new Error(
      "OrcaRouter returned zero models.",
    );
  }

  return {
    provider: PROVIDER,

    source: {
      url: URL,
      fetchedAt:
        new Date().toISOString(),
    },

    models:
      models.map(normalizeModel),
  };
}