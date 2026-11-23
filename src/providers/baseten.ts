import type {
  ModelPricing,
  Price,
  PricingTier,
  ProviderPricing,
} from "../types";

import {
  clean,
  fetchMarkdown,
  nodeText,
  parseMarkdown,
  parseNumber,
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

function slugify(
  value: string,
): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Find the first link URL inside an mdast node.
 */
function firstLink(
  node: any,
): string | undefined {
  if (!node) {
    return undefined;
  }

  if (
    node.type === "link" &&
    typeof node.url === "string"
  ) {
    return node.url;
  }

  for (const child of node.children ?? []) {
    const url = firstLink(child);

    if (url) {
      return url;
    }
  }

  return undefined;
}

/**
 * Baseten serves a markdown version of the pricing
 * page when the request prefers text/markdown, which
 * fetchMarkdown does. The Model APIs prices live in a
 * table headed "Model | Input | Cache input | Output".
 *
 * Convert those rows into BasetenModel records so the
 * normal normalizeModel path handles them.
 */
function extractMarkdownRecords(
  markdown: string,
): BasetenModel[] {
  const tree =
    parseMarkdown(markdown);

  const records: BasetenModel[] = [];
  const seen = new Set<string>();

  const tables: any[] = [];

  (function walk(node: any) {
    if (node.type === "table") {
      tables.push(node);
      return;
    }

    for (const child of node.children ?? []) {
      walk(child);
    }
  })(tree);

  for (const table of tables) {
    const rows: any[] =
      table.children ?? [];

    if (rows.length < 2) {
      continue;
    }

    const headers: string[] =
      rows[0].children.map((cell: any) =>
        clean(nodeText(cell)).toLowerCase(),
      );

    const modelIndex =
      headers.findIndex((h) => h.includes("model"));

    const cacheIndex =
      headers.findIndex((h) => h.includes("cache"));

    const inputIndex =
      headers.findIndex((h, i) =>
        i !== cacheIndex && h.includes("input"),
      );

    const outputIndex =
      headers.findIndex((h) => h.includes("output"));

    if (
      modelIndex < 0 ||
      inputIndex < 0
    ) {
      continue;
    }

    for (const row of rows.slice(1)) {
      const cells: any[] =
        row.children ?? [];

      const name =
        clean(nodeText(cells[modelIndex]));

      if (!name) {
        continue;
      }

      const cellNumber = (index: number) =>
        index < 0
          ? null
          : parseNumber(clean(nodeText(cells[index])));

      const link =
        firstLink(cells[modelIndex]);

      const slug =
        link
          ?.split(/[?#]/)[0]
          .split("/")
          .filter(Boolean)
          .pop() ??
        slugify(name);

      if (seen.has(slug)) {
        continue;
      }

      seen.add(slug);

      records.push({
        name,
        slug,
        tryModelApiLink: link,
        perfCost: cellNumber(inputIndex),
        perfCostCacheInput: cellNumber(cacheIndex),
        perfCostOutput: cellNumber(outputIndex),
      });
    }
  }

  return records;
}

export async function getBasetenPricing():
  Promise<ProviderPricing> {
  const content =
    await fetchMarkdown(URL);

  let records =
    extractModelRecords(
      extractFlightPayload(content),
    );

  if (records.length === 0) {
    records =
      extractMarkdownRecords(content);
  }

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
