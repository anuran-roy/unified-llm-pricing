import type {
  ModelPricing,
  Price,
  PricingTier,
  ProviderPricing,
} from "../types";

import {
  fetchMarkdown,
} from "../utils/markdown";

const URL =
  "https://www.baseten.co/pricing/";

const PROVIDER = "baseten";

interface BasetenModel {
  __typename?: string;

  name?: string;
  slug?: string;
  isClosedModel?: boolean | null;
  availability?: string[];

  deployLink?: string;
  tryModelApiLink?: string;

  publisher?: {
    name?: string;
  };

  /*
   * USD per 1M tokens.
   */
  perfCost?: number | null;
  perfCostOutput?: number | null;
  perfCostCacheInput?: number | null;

  [key: string]: unknown;
}

function tokenPrice(
  amount: number,
  raw: string,
): Price {
  return {
    amount,
    currency: "USD",
    units: 1_000_000,
    pricingType: "token",
    modality: "text",
    raw,
  };
}

/**
 * Baseten renders the pricing page as a Next.js
 * app; the model catalog is embedded in the flight
 * payload as escaped JSON chunks.
 *
 * Collect the chunk strings and join them.
 */
function extractFlightPayload(
  html: string,
): string {
  const chunks: string[] = [];

  const pattern =
    /self\.__next_f\.push\(\[1,("(?:\\.|[^"\\])*")\]\)/g;

  let match:
    | RegExpExecArray
    | null;

  while (
    (match = pattern.exec(html))
  ) {
    try {
      chunks.push(
        JSON.parse(match[1]),
      );
    } catch {
      // Ignore malformed chunks.
    }
  }

  return chunks.join("");
}

/**
 * Extract every "LibraryModelRecord" JSON object
 * from the flight payload.
 */
function extractModelRecords(
  payload: string,
): BasetenModel[] {
  const records: BasetenModel[] = [];

  const KEY =
    '"__typename":"LibraryModelRecord"';

  let searchFrom = 0;

  while (true) {
    const index =
      payload.indexOf(
        KEY,
        searchFrom,
      );

    if (index < 0) {
      break;
    }

    const open =
      payload.lastIndexOf(
        "{",
        index,
      );

    let depth = 0;
    let end = open;
    let inString = false;
    let escaped = false;

    for (
      ;
      end < payload.length;
      end++
    ) {
      const char =
        payload[end];

      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (
          char === "\\"
        ) {
          escaped = true;
        } else if (
          char === '"'
        ) {
          inString = false;
        }

        continue;
      }

      if (char === '"') {
        inString = true;
      } else if (
        char === "{"
      ) {
        depth++;
      } else if (
        char === "}"
      ) {
        depth--;

        if (depth === 0) {
          break;
        }
      }
    }

    try {
      records.push(
        JSON.parse(
          payload.slice(
            open,
            end + 1,
          ),
        ),
      );
    } catch {
      // Ignore malformed records.
    }

    searchFrom = end + 1;
  }

  return records;
}

function normalizeModel(
  record: BasetenModel,
): ModelPricing | undefined {
  const tier: PricingTier = {
    name: "standard",
    input: [],
    output: [],
    cacheRead: [],
    cacheWrite: [],
    other: [],
  };

  if (
    typeof record.perfCost ===
    "number"
  ) {
    tier.input?.push(
      tokenPrice(
        record.perfCost,
        String(record.perfCost),
      ),
    );
  }

  if (
    typeof record.perfCostOutput ===
    "number"
  ) {
    tier.output?.push(
      tokenPrice(
        record.perfCostOutput,
        String(record.perfCostOutput),
      ),
    );
  }

  if (
    typeof record.perfCostCacheInput ===
    "number"
  ) {
    tier.cacheRead?.push(
      tokenPrice(
        record.perfCostCacheInput,
        String(record.perfCostCacheInput),
      ),
    );
  }

  const hasPrices =
    tier.input!.length > 0 ||
    tier.output!.length > 0 ||
    tier.cacheRead!.length > 0;

  if (!hasPrices) {
    return undefined;
  }

  return {
    id:
      record.slug ??
      record.name ??
      "unknown",
    name: record.name,
    provider: PROVIDER,
    tiers: [tier],
    metadata: {
      source: "baseten",
      isClosedModel:
        record.isClosedModel,
      availability:
        record.availability,
      publisher:
        record.publisher?.name,
      deployLink:
        record.deployLink,
      tryModelApiLink:
        record.tryModelApiLink,
    },
  };
}

export async function getBasetenPricing():
  Promise<ProviderPricing> {
  const html =
    await fetchMarkdown(URL);

  const payload =
    extractFlightPayload(html);

  const records =
    extractModelRecords(payload);

  const models: ModelPricing[] = [];

  for (const record of records) {
    const model =
      normalizeModel(record);

    if (model) {
      models.push(model);
    }
  }

  if (models.length === 0) {
    throw new Error(
      "Baseten parser extracted zero Model API models. " +
      "The pricing page structure may have changed.",
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