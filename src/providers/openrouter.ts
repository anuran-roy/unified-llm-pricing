import type {
  ModelPricing,
  Price,
  PricingTier,
  ProviderPricing,
} from "../types.js";

import { inferModelModality } from "../utils/modality.js";

const MODELS_URL =
  "https://openrouter.ai/api/v1/models";

const OPENROUTER_URL =
  "https://openrouter.ai";

interface OpenRouterModel {
  id: string;
  name?: string;
  canonical_slug?: string;

  description?: string;

  created?: number;

  context_length?: number;
  max_completion_tokens?: number;

  architecture?: {
    modality?: string;
    input_modalities?: string[];
    output_modalities?: string[];
    tokenizer?: string;
    instruct_type?: string | null;
  };

  pricing?: Record<string, string>;

  supported_parameters?: string[];

  top_provider?: {
    context_length?: number;
    max_completion_tokens?: number;
    is_moderated?: boolean;
  };

  [key: string]: unknown;
}

interface OpenRouterModelsResponse {
  data: OpenRouterModel[];
}

interface OpenRouterEndpoint {
  name?: string;

  model_name?: string;
  model_id?: string;

  provider_name?: string;
  provider_slug?: string;

  context_length?: number;
  max_completion_tokens?: number;

  pricing?: Record<string, string>;

  supported_parameters?: string[];

  quantization?: string;

  status?: string;

  uptime_last_30m?: number;
  latency_last_30m?: number;
  throughput_last_30m?: number;

  [key: string]: unknown;
}

interface OpenRouterEndpointsData {
  id: string;
  name?: string;
  endpoints: OpenRouterEndpoint[];
}

interface OpenRouterEndpointsResponse {
  data: OpenRouterEndpointsData;
}

/**
 * OpenRouter prices token pricing in USD/token.
 *
 * We normalize:
 *
 *   0.000001
 *
 * into:
 *
 *   $1 / 1M tokens
 */
function tokenPrice(
  value: string | undefined,
  modality: Price["modality"] = "text",
): Price | undefined {
  if (value === undefined) {
    return undefined;
  }

  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return undefined;
  }

  return {
    amount: amount * 1_000_000,
    currency: "USD",
    units: 1_000_000,
    pricingType: "token",
    modality,
    raw: value,
  };
}

/**
 * OpenRouter request/image/audio prices are already expressed
 * as USD per unit, so they are not multiplied by 1M.
 */
function unitPrice(
  value: string | undefined,
  pricingType: string,
  modality?: "text" | "image" | "audio",
): Price | undefined {
  if (value === undefined) {
    return undefined;
  }

  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return undefined;
  }

  return {
    amount,
    currency: "USD",
    units: 1,
    pricingType,
    modality,
    raw: value,
  };
}

/**
 * Convert OpenRouter pricing into our unified PricingTier.
 *
 * Known OpenRouter pricing fields:
 *
 *   prompt
 *   completion
 *   request
 *   image
 *   web_search
 *   internal_reasoning
 *   input_cache_read
 *   input_cache_write
 */
function normalizePricing(
  pricing?: Record<string, string>,
  modality: Price["modality"] = "text",
): PricingTier {
  const tier: PricingTier = {
    name: "default",
    input: [],
    output: [],
    cacheRead: [],
    cacheWrite: [],
    other: [],
  };

  if (!pricing) {
    return tier;
  }

  const prompt = tokenPrice(
    pricing.prompt,
    modality,
  );

  if (prompt) {
    tier.input!.push(prompt);
  }

  const completion = tokenPrice(
    pricing.completion,
    modality,
  );

  if (completion) {
    tier.output!.push(completion);
  }

  const cacheRead = tokenPrice(
    pricing.input_cache_read,
    modality,
  );

  if (cacheRead) {
    tier.cacheRead!.push(cacheRead);
  }

  const cacheWrite = tokenPrice(
    pricing.input_cache_write,
    modality,
  );

  if (cacheWrite) {
    tier.cacheWrite!.push(cacheWrite);
  }

  const image = unitPrice(
    pricing.image,
    "image",
    "image",
  );

  if (image) {
    tier.other!.push(image);
  }

  const request = unitPrice(
    pricing.request,
    "request",
  );

  if (request) {
    tier.other!.push(request);
  }

  const webSearch = unitPrice(
    pricing.web_search,
    "request",
  );

  if (webSearch) {
    tier.other!.push({
      ...webSearch,
      raw: pricing.web_search,
    });
  }

  const reasoning = tokenPrice(
    pricing.internal_reasoning,
    modality,
  );

  if (reasoning) {
    tier.other!.push(reasoning);
  }

  return tier;
}

/**
 * Infer the price modality of an OpenRouter model from its
 * architecture. Embedding, image, audio, and video models
 * report non-text output modalities even though their token
 * prices are not labelled as such in the pricing payload.
 */
function modelModality(
  model: OpenRouterModel,
): Price["modality"] {
  return (
    inferModelModality(model) ??
    "text"
  );
}

/**
 * Split:
 *
 *   deepseek/deepseek-chat-v3-0324
 *
 * into:
 *
 *   author = deepseek
 *   slug   = deepseek-chat-v3-0324
 */
function splitModelId(
  id: string,
): {
  author: string;
  slug: string;
} {
  const index = id.indexOf("/");

  if (index === -1) {
    throw new Error(
      `Invalid OpenRouter model ID: ${id}`,
    );
  }

  return {
    author: id.slice(0, index),
    slug: id.slice(index + 1),
  };
}

/**
 * Fetch all models from OpenRouter.
 *
 * `output_modalities=all` is important because the default
 * endpoint only returns text-output models.
 */
async function fetchModels(): Promise<
  OpenRouterModel[]
> {
  const response = await fetch(
    `${MODELS_URL}?output_modalities=all`,
    {
      headers: {
        Accept: "application/json",
      },
    },
  );

  if (!response.ok) {
    throw new Error(
      `OpenRouter models request failed: ` +
      `${response.status} ${response.statusText}`,
    );
  }

  const result =
    (await response.json()) as OpenRouterModelsResponse;

  return result.data ?? [];
}

/**
 * Fetch provider endpoints for one OpenRouter model.
 *
 * The response shape is:
 *
 * {
 *   data: {
 *     id: "...",
 *     name: "...",
 *     endpoints: [...]
 *   }
 * }
 */
async function fetchEndpoints(
  modelId: string,
): Promise<OpenRouterEndpoint[]> {
  const { author, slug } =
    splitModelId(modelId);

  const url =
    `${MODELS_URL}/` +
    `${encodeURIComponent(author)}/` +
    `${encodeURIComponent(slug)}/` +
    `endpoints`;

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(
      `OpenRouter endpoint request failed for ` +
      `${modelId}: ` +
      `${response.status} ${response.statusText}`,
    );
  }

  const result =
    (await response.json()) as OpenRouterEndpointsResponse;

  return result.data?.endpoints ?? [];
}

/**
 * Convert one OpenRouter endpoint into our ModelPricing type.
 */
function normalizeEndpoint(
  model: OpenRouterModel,
  endpoint: OpenRouterEndpoint,
): ModelPricing {
  const providerName =
    endpoint.provider_name ??
    endpoint.provider_slug ??
    "unknown";

  const providerSlug =
    endpoint.provider_slug ??
    providerName
      .toLowerCase()
      .replace(/\s+/g, "-");

  const tier =
    normalizePricing(
      endpoint.pricing,
      modelModality(model),
    );

  return {
    /**
     * Composite ID is intentional.
     *
     * The same logical model can be served by multiple
     * OpenRouter providers at different prices.
     */
    id:
      `${model.id}@${providerSlug}`,

    name:
      endpoint.model_name ??
      model.name,

    /**
     * Your existing Provider type is the logical provider
     * represented by this ModelPricing entry.
     *
     * Since this is an OpenRouter adapter, we keep the
     * top-level provider as OpenRouter and put the actual
     * serving provider in metadata.
     */
    provider: "openrouter",

    tiers: [tier],

    metadata: {
      source: "openrouter",

      modelId: model.id,

      canonicalSlug:
        model.canonical_slug,

      servingProvider:
        providerName,

      servingProviderSlug:
        providerSlug,

      contextLength:
        endpoint.context_length ??
        model.context_length,

      maxCompletionTokens:
        endpoint.max_completion_tokens ??
        model.max_completion_tokens,

      quantization:
        endpoint.quantization,

      status:
        endpoint.status,

      supportedParameters:
        endpoint.supported_parameters ??
        model.supported_parameters,

      architecture:
        model.architecture,

      description:
        model.description,

      uptimeLast30m:
        endpoint.uptime_last_30m,

      latencyLast30m:
        endpoint.latency_last_30m,

      throughputLast30m:
        endpoint.throughput_last_30m,

      rawEndpoint:
        endpoint,
    },
  };
}

/**
 * Fetch the complete OpenRouter catalog and normalize
 * model/provider combinations.
 *
 * For example:
 *
 * deepseek/deepseek-chat-v3-0324
 *
 * can become:
 *
 * deepseek/deepseek-chat-v3-0324@deepinfra
 * deepseek/deepseek-chat-v3-0324@siliconflow
 * deepseek/deepseek-chat-v3-0324@novitaai
 * ...
 */
export async function getOpenRouterPricing():
  Promise<ProviderPricing> {
  const fetchedAt =
    new Date().toISOString();

  const models =
    await fetchModels();

  const normalized: ModelPricing[] = [];

  /**
   * Limit concurrency so that a catalog-wide refresh does
   * not hammer OpenRouter with hundreds of simultaneous
   * requests.
   */
  const CONCURRENCY = 8;

  for (
    let i = 0;
    i < models.length;
    i += CONCURRENCY
  ) {
    const batch =
      models.slice(
        i,
        i + CONCURRENCY,
      );

    const results =
      await Promise.allSettled(
        batch.map(async (model) => {
          const endpoints =
            await fetchEndpoints(model.id);

          return {
            model,
            endpoints,
          };
        }),
      );

    for (const result of results) {
      if (
        result.status ===
        "rejected"
      ) {
        console.warn(
          "[OpenRouter] Failed to fetch model endpoints:",
          result.reason,
        );

        continue;
      }

      const {
        model,
        endpoints,
      } = result.value;

      /**
       * If OpenRouter has no endpoint data for the model,
       * retain the model-level pricing rather than silently
       * dropping it.
       */
      if (endpoints.length === 0) {
        normalized.push({
          id: model.id,

          name: model.name,

          provider: "openrouter",

          tiers: [
            normalizePricing(
              model.pricing,
              modelModality(model),
            ),
          ],

          metadata: {
            source: "openrouter",

            canonicalSlug:
              model.canonical_slug,

            contextLength:
              model.context_length,

            maxCompletionTokens:
              model.max_completion_tokens,

            architecture:
              model.architecture,

            supportedParameters:
              model.supported_parameters,

            description:
              model.description,

            endpointCount: 0,
          },
        });

        continue;
      }

      for (
        const endpoint of endpoints
      ) {
        normalized.push(
          normalizeEndpoint(
            model,
            endpoint,
          ),
        );
      }
    }

    console.log(
      `[OpenRouter] Processed ` +
      `${Math.min(
        i + CONCURRENCY,
        models.length,
      )}/${models.length} models`,
    );
  }

  return {
    provider: "openrouter",

    source: {
      url:
        `${MODELS_URL}?output_modalities=all`,

      fetchedAt,
    },

    models: normalized,
  };
}

