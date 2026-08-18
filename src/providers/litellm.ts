import type {
  ModelPricing,
  Price,
  PricingTier,
  ProviderPricing,
} from "../types";

const CATALOG_URL =
  "https://api.litellm.ai/model_catalog";

const PROVIDER = "litellm";

const PAGE_SIZE = 500;

interface CatalogEntry {
  id: string;

  provider?: string;
  mode?: string;

  max_input_tokens?: number | null;
  max_output_tokens?: number | null;
  max_tokens?: number | null;

  input_cost_per_token?: number | null;
  output_cost_per_token?: number | null;

  input_cost_per_token_batches?: number | null;
  output_cost_per_token_batches?: number | null;

  input_cost_per_token_priority?: number | null;
  output_cost_per_token_priority?: number | null;

  input_cost_per_token_above_200k_tokens?: number | null;
  output_cost_per_token_above_200k_tokens?: number | null;

  input_cost_per_token_above_272k_tokens?: number | null;
  output_cost_per_token_above_272k_tokens?: number | null;

  input_cost_per_token_above_272k_tokens_priority?: number | null;
  output_cost_per_token_above_272k_tokens_priority?: number | null;

  cache_read_input_token_cost?: number | null;
  cache_creation_input_token_cost?: number | null;

  cache_read_input_token_cost_above_200k_tokens?: number | null;
  cache_read_input_token_cost_above_272k_tokens?: number | null;
  cache_read_input_token_cost_priority?: number | null;
  cache_read_input_token_cost_above_272k_tokens_priority?: number | null;

  cache_creation_input_token_cost_above_200k_tokens?: number | null;
  cache_creation_input_token_cost_above_272k_tokens?: number | null;
  cache_creation_input_token_cost_above_1hr?: number | null;
  cache_creation_input_token_cost_above_1hr_above_200k_tokens?: number | null;

  cache_read_input_audio_token_cost?: number | null;
  cache_creation_input_audio_token_cost?: number | null;

  input_cost_per_audio_token?: number | null;
  output_cost_per_audio_token?: number | null;

  input_cost_per_image_token?: number | null;
  output_cost_per_image_token?: number | null;

  output_cost_per_reasoning_token?: number | null;

  input_cost_per_second?: number | null;
  output_cost_per_second?: number | null;
  input_cost_per_audio_per_second?: number | null;
  input_cost_per_video_per_second?: number | null;

  input_cost_per_image?: number | null;
  output_cost_per_image?: number | null;

  input_cost_per_pixel?: number | null;
  output_cost_per_pixel?: number | null;

  input_cost_per_character?: number | null;

  input_cost_per_query?: number | null;
  search_context_cost_per_query?: number | null;

  ocr_cost_per_page?: number | null;

  code_interpreter_cost_per_session?: number | null;

  deprecation_date?: string | null;

  supports_function_calling?: boolean | null;
  supports_parallel_function_calling?: boolean | null;
  supports_vision?: boolean | null;
  supports_audio_input?: boolean | null;
  supports_audio_output?: boolean | null;
  supports_prompt_caching?: boolean | null;
  supports_reasoning?: boolean | null;
  supports_response_schema?: boolean | null;
  supports_system_messages?: boolean | null;
  supports_web_search?: boolean | null;

  [key: string]: unknown;
}

interface CatalogResponse {
  data: CatalogEntry[];
  total_count: number;
  has_more: boolean;
  page: number;
  page_size: number;
}

type PriceCategory =
  | "input"
  | "output"
  | "cacheRead"
  | "cacheWrite"
  | "other";

/**
 * LiteLLM prices token costs in USD/token.
 *
 * We normalize:
 *
 *   0.00000125
 *
 * into:
 *
 *   $1.25 / 1M tokens
 */
function tokenPrice(
  amount: number,
  modality?: Price["modality"],
): Price {
  return {
    amount: amount * 1_000_000,
    currency: "USD",
    units: 1_000_000,
    pricingType: "token",
    modality,
    raw: String(amount),
  };
}

/**
 * Non-token costs (per second, per image, per page,
 * ...) are already expressed as USD per unit.
 */
function unitPrice(
  amount: number,
  pricingType: Price["pricingType"],
  modality?: Price["modality"],
): Price {
  return {
    amount,
    currency: "USD",
    units: 1,
    pricingType,
    modality,
    raw: String(amount),
  };
}

interface FieldMapping {
  category: PriceCategory;
  pricingType: Price["pricingType"];
  modality?: Price["modality"];
}

/**
 * Map catalog cost fields onto our unified price
 * buckets. Token fields are priced per 1M tokens,
 * everything else per unit.
 */
const TOKEN_FIELDS: Record<string, FieldMapping> = {
  input_cost_per_token: { category: "input", pricingType: "token" },
  input_cost_per_token_batches: { category: "input", pricingType: "token" },
  input_cost_per_token_priority: { category: "input", pricingType: "token" },
  input_cost_per_token_above_200k_tokens: { category: "input", pricingType: "token" },
  input_cost_per_token_above_272k_tokens: { category: "input", pricingType: "token" },
  input_cost_per_token_above_272k_tokens_priority: { category: "input", pricingType: "token" },

  output_cost_per_token: { category: "output", pricingType: "token" },
  output_cost_per_token_batches: { category: "output", pricingType: "token" },
  output_cost_per_token_priority: { category: "output", pricingType: "token" },
  output_cost_per_token_above_200k_tokens: { category: "output", pricingType: "token" },
  output_cost_per_token_above_272k_tokens: { category: "output", pricingType: "token" },
  output_cost_per_token_above_272k_tokens_priority: { category: "output", pricingType: "token" },

  cache_read_input_token_cost: { category: "cacheRead", pricingType: "token" },
  cache_read_input_token_cost_above_200k_tokens: { category: "cacheRead", pricingType: "token" },
  cache_read_input_token_cost_above_272k_tokens: { category: "cacheRead", pricingType: "token" },
  cache_read_input_token_cost_priority: { category: "cacheRead", pricingType: "token" },
  cache_read_input_token_cost_above_272k_tokens_priority: { category: "cacheRead", pricingType: "token" },

  cache_creation_input_token_cost: { category: "cacheWrite", pricingType: "token" },
  cache_creation_input_token_cost_above_200k_tokens: { category: "cacheWrite", pricingType: "token" },
  cache_creation_input_token_cost_above_272k_tokens: { category: "cacheWrite", pricingType: "token" },
  cache_creation_input_token_cost_above_1hr: { category: "cacheWrite", pricingType: "token" },
  cache_creation_input_token_cost_above_1hr_above_200k_tokens: { category: "cacheWrite", pricingType: "token" },

  cache_read_input_audio_token_cost: { category: "cacheRead", pricingType: "token", modality: "audio" },
  cache_creation_input_audio_token_cost: { category: "cacheWrite", pricingType: "token", modality: "audio" },

  input_cost_per_audio_token: { category: "input", pricingType: "token", modality: "audio" },
  output_cost_per_audio_token: { category: "output", pricingType: "token", modality: "audio" },

  input_cost_per_image_token: { category: "input", pricingType: "token", modality: "image" },
  output_cost_per_image_token: { category: "output", pricingType: "token", modality: "image" },

  output_cost_per_reasoning_token: { category: "other", pricingType: "token" },
};

const UNIT_FIELDS: Record<string, FieldMapping> = {
  input_cost_per_second: { category: "other", pricingType: "second" },
  output_cost_per_second: { category: "other", pricingType: "second" },
  input_cost_per_audio_per_second: { category: "other", pricingType: "second", modality: "audio" },
  input_cost_per_video_per_second: { category: "other", pricingType: "second", modality: "video" },

  input_cost_per_image: { category: "other", pricingType: "image", modality: "image" },
  output_cost_per_image: { category: "other", pricingType: "image", modality: "image" },

  input_cost_per_pixel: { category: "other", pricingType: "pixel", modality: "image" },
  output_cost_per_pixel: { category: "other", pricingType: "pixel", modality: "image" },

  input_cost_per_character: { category: "other", pricingType: "character" },

  input_cost_per_query: { category: "other", pricingType: "request" },
  search_context_cost_per_query: { category: "other", pricingType: "request" },

  ocr_cost_per_page: { category: "other", pricingType: "page" },

  code_interpreter_cost_per_session: { category: "other", pricingType: "session" },
};

/**
 * Map a catalog mode onto a modality hint for
 * token prices.
 */
function modeModality(
  mode: string | undefined,
): Price["modality"] | undefined {
  switch (mode) {
    case "image_generation":
    case "image_edit":
      return "image";
    case "audio_speech":
    case "audio_transcription":
    case "realtime":
      return "audio";
    case "video_generation":
      return "video";
    case "embedding":
      return "embedding";
    case "rerank":
      return "rerank";
    default:
      return "text";
  }
}

/**
 * Convert one catalog entry into a ModelPricing
 * with a single "default" tier.
 */
function normalizeEntry(
  entry: CatalogEntry,
): ModelPricing | undefined {
  const tier: PricingTier = {
    name: "default",
    input: [],
    output: [],
    cacheRead: [],
    cacheWrite: [],
    other: [],
  };

  const modality =
    modeModality(entry.mode);

  let count = 0;

  for (const [field, mapping] of Object.entries(TOKEN_FIELDS)) {
    const value = entry[field];

    if (typeof value !== "number") {
      continue;
    }

    const price = tokenPrice(
      value,
      mapping.modality ?? modality,
    );

    tier[mapping.category]!.push(price);

    count++;
  }

  for (const [field, mapping] of Object.entries(UNIT_FIELDS)) {
    const value = entry[field];

    if (typeof value !== "number") {
      continue;
    }

    const price = unitPrice(
      value,
      mapping.pricingType,
      mapping.modality,
    );

    tier[mapping.category]!.push(price);

    count++;
  }

  if (count === 0) {
    return undefined;
  }

  return {
    id: entry.id,
    name: entry.id,
    provider: PROVIDER,
    tiers: [tier],
    metadata: {
      source: "litellm",
      mode: entry.mode,
      servingProvider: entry.provider,
      maxInputTokens: entry.max_input_tokens,
      maxOutputTokens: entry.max_output_tokens,
      maxTokens: entry.max_tokens,
      deprecationDate: entry.deprecation_date,
      supports: {
        functionCalling: entry.supports_function_calling,
        parallelFunctionCalling: entry.supports_parallel_function_calling,
        vision: entry.supports_vision,
        audioInput: entry.supports_audio_input,
        audioOutput: entry.supports_audio_output,
        promptCaching: entry.supports_prompt_caching,
        reasoning: entry.supports_reasoning,
        responseSchema: entry.supports_response_schema,
        systemMessages: entry.supports_system_messages,
        webSearch: entry.supports_web_search,
      },
    },
  };
}

/**
 * Fetch the full catalog, following pagination.
 */
async function fetchCatalog(): Promise<
  CatalogEntry[]
> {
  const entries: CatalogEntry[] = [];

  let page = 1;

  while (true) {
    const url =
      `${CATALOG_URL}?page=${page}` +
      `&page_size=${PAGE_SIZE}`;

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(
        `LiteLLM catalog request failed: ` +
        `${response.status} ${response.statusText}`,
      );
    }

    const result =
      (await response.json()) as CatalogResponse;

    entries.push(...(result.data ?? []));

    if (!result.has_more) {
      break;
    }

    page++;
  }

  return entries;
}

export async function getLiteLLMPricing(): Promise<ProviderPricing> {
  const entries =
    await fetchCatalog();

  const models: ModelPricing[] = [];

  for (const entry of entries) {
    const model =
      normalizeEntry(entry);

    if (model) {
      models.push(model);
    }
  }

  return {
    provider: PROVIDER,
    source: {
      url: CATALOG_URL,
      fetchedAt:
        new Date().toISOString(),
    },
    models,
  };
}