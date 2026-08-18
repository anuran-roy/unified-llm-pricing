import type {
  Root,
  Table,
  TableCell,
  TableRow,
} from "mdast";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import { unified } from "unified";
import { visit } from "unist-util-visit";

import type {
  Modality,
  ModelPricing,
  Price,
  PricingTier,
  ProviderPricing,
} from "../types.js";

import { inferModelModality } from "../utils/modality.js";

const GEMINI_PRICING_URL =
  "https://ai.google.dev/gemini-api/docs/pricing.md.txt";

const PROVIDER = "google";

/**
 * Fetch the raw Gemini pricing document.
 */
async function fetchGeminiPricingPage(): Promise<string> {
  const response = await fetch(GEMINI_PRICING_URL, {
    headers: {
      "User-Agent":
        "unified-llm-pricing/1.0",
      Accept:
        "text/plain,text/markdown,text/html;q=0.9,*/*;q=0.8",
    },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch Gemini pricing: ` +
      `${response.status} ${response.statusText}`,
    );
  }

  const content = await response.text();

  if (content.length < 1_000) {
    throw new Error(
      `Gemini pricing page is unexpectedly short: ` +
      `${content.length} characters`,
    );
  }

  return content;
}

/**
 * Convert an MDAST node into plain text.
 */
function getText(node: any): string {
  if (!node) {
    return "";
  }

  if (typeof node === "string") {
    return node;
  }

  if (typeof node.value === "string") {
    return node.value;
  }

  if (node.children) {
    return node.children
      .map(getText)
      .join("");
  }

  return "";
}

function clean(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .replace(/\*/g, "")
    .replace(/`/g, "")
    .trim();
}

/**
 * Extract a Gemini model ID from a heading,
 * e.g. "`gemini-3.7-flash`".
 */
function extractModelId(
  value: string,
): string | null {
  const match = value.match(
    /`([a-zA-Z0-9][a-zA-Z0-9._:-]*)`/,
  );

  return match?.[1] ?? null;
}

/**
 * Extract a model ID from an inline code
 * node, e.g. `*`gemini-3.7-flash`*`.
 */
function extractModelIdFromNode(
  node: any,
): string | null {
  if (node.type === "inlineCode") {
    const match = node.value.match(
      /^([a-zA-Z0-9][a-zA-Z0-9._:-]*)$/,
    );

    return match?.[1] ?? null;
  }

  if (node.children) {
    for (const child of node.children) {
      const id =
        extractModelIdFromNode(
          child,
        );

      if (id) {
        return id;
      }
    }
  }

  return null;
}

/**
 * Extract the numeric price from a provider string.
 */
function parseNumber(
  value: string,
): number | null {
  const normalized = value
    .replace(/,/g, "")
    .replace(/\$/g, "")
    .trim();

  const match = normalized.match(
    /-?\d+(?:\.\d+)?/,
  );

  if (!match) {
    return null;
  }

  const number = Number(match[0]);

  return Number.isFinite(number)
    ? number
    : null;
}

function detectModality(
  value: string,
): Modality | undefined {
  const v = value.toLowerCase();

  const matches: Modality[] = [
    "text",
    "image",
    "audio",
    "video",
  ].filter((modality) =>
    v.includes(modality),
  );

  if (matches.length === 1) {
    return matches[0];
  }

  return undefined;
}

/**
 * Convert Google's units into the unified representation.
 */
function detectUnits(
  value: string,
): {
  pricingType: Price["pricingType"];
  units?: number;
} {
  const v = value.toLowerCase();

  if (
    v.includes("per minute") ||
    v.includes("/minute") ||
    v.includes("$/minute")
  ) {
    return {
      pricingType: "minute",
      units: 1,
    };
  }

  if (
    v.includes("per image") ||
    v.includes("/image")
  ) {
    return {
      pricingType: "image",
      units: 1,
    };
  }

  if (
    v.includes("per 1,000") ||
    v.includes("per 1000")
  ) {
    return {
      pricingType: "request",
      units: 1_000,
    };
  }

  if (
    v.includes("per hour") ||
    v.includes("/hour")
  ) {
    return {
      pricingType: "hour",
      units: 1,
    };
  }

  /*
   * Gemini's token pricing is generally expressed
   * as "$X per 1M tokens".
   */
  return {
    pricingType: "token",
    units: 1_000_000,
  };
}

function parsePrices(
  value: string,
): Price[] {
  const result: Price[] = [];

  const parts = value
    .split(/\n|(?<=\))\s+(?=\$|\d)/)
    .map(clean)
    .filter(Boolean);

  for (const part of parts) {
    const amount = parseNumber(part);

    if (amount === null) {
      continue;
    }

    const units = detectUnits(part);

    result.push({
      amount,
      currency: "USD",
      pricingType: units.pricingType,
      units: units.units,
      modality: detectModality(part),
      raw: part,
    });
  }

  return result;
}

function ensureTier(
  model: ModelPricing,
  name: string,
): PricingTier {
  let tier = model.tiers.find(
    (tier) => tier.name === name,
  );

  if (!tier) {
    tier = {
      name,
      input: [],
      output: [],
      cacheRead: [],
      cacheWrite: [],
      other: [],
    };

    model.tiers.push(tier);
  }

  return tier;
}

/**
 * Parse a single Gemini pricing table.
 */
function parseTable(
  table: Table,
  model: ModelPricing,
  tierName: string,
): void {
  const rows = table.children as TableRow[];

  if (rows.length < 2) {
    return;
  }

  const headers = rows[0].children.map(
    (cell: TableCell) =>
      clean(getText(cell)),
  );

  /*
   * Google may use different terminology for
   * the paid pricing column.
   */
  const paidColumn = headers.findIndex(
    (header) =>
      /paid|pay-as-you-go|standard|batch|flex|priority/i.test(
        header,
      ),
  );

  const tier = ensureTier(
    model,
    tierName,
  );

  for (const row of rows.slice(1)) {
    const cells = row.children.map(
      (cell: TableCell) =>
        clean(getText(cell)),
    );

    const rowName =
      cells[0]?.toLowerCase() ?? "";

    const value =
      paidColumn >= 0
        ? cells[paidColumn]
        : cells[cells.length - 1];

    if (!value) {
      continue;
    }

    const prices = parsePrices(value);

    if (prices.length === 0) {
      continue;
    }

    if (rowName.includes("input")) {
      tier.input?.push(...prices);
      continue;
    }

    if (rowName.includes("output")) {
      tier.output?.push(...prices);
      continue;
    }

    if (
      rowName.includes("cache") ||
      rowName.includes("context")
    ) {
      tier.cacheRead?.push(...prices);
      continue;
    }

    tier.other?.push(...prices);
  }
}

/**
 * Google's pricing tables do not label token prices on
 * embedding, image, audio, and video models, so tag
 * unlabelled token prices with the inferred modality.
 */
function tagModelModality(
  model: ModelPricing,
): void {
  const inferred =
    inferModelModality(model);

  if (!inferred) {
    return;
  }

  for (const tier of model.tiers) {
    for (const arr of [
      tier.input,
      tier.output,
      tier.cacheRead,
      tier.cacheWrite,
      tier.other,
    ]) {
      for (const price of arr ?? []) {
        if (
          !price.modality &&
          price.pricingType === "token"
        ) {
          price.modality = inferred;
        }
      }
    }
  }
}

/**
 * Parse the entire Gemini pricing document.
 */
function parseGeminiMarkdown(
  markdown: string,
): ModelPricing[] {
  const tree = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .parse(markdown) as Root;

  const models: ModelPricing[] = [];

  let currentModel:
    | ModelPricing
    | null = null;

  let currentTier = "standard";

  visit(tree, (node, index, parent) => {
    if (node.type === "heading") {
      const heading = clean(
        getText(node),
      );

      let modelId =
        extractModelId(heading);

      /*
       * Google moved the model ID out of the
       * heading and into the paragraph that
       * follows it, e.g. "`gemini-3.7-flash`".
       */
      if (!modelId && parent) {
        const next =
          parent.children[
            (index ?? 0) + 1
          ];

        if (
          next?.type === "paragraph"
        ) {
          modelId =
            extractModelIdFromNode(
              next,
            );
        }
      }

      if (modelId) {
        currentModel = {
          id: modelId,
          name: heading
            .replace(/`[^`]+`/g, "")
            .trim(),
          provider: PROVIDER,
          tiers: [],
        };

        models.push(currentModel);

        currentTier = "standard";

        ensureTier(
          currentModel,
          currentTier,
        );

        return;
      }

      if (
        /^(standard|batch|flex|priority)$/i.test(
          heading,
        )
      ) {
        currentTier =
          heading.toLowerCase();

        if (currentModel) {
          ensureTier(
            currentModel,
            currentTier,
          );
        }
      }
    }

    if (
      node.type === "table" &&
      currentModel
    ) {
      parseTable(
        node,
        currentModel,
        currentTier,
      );
    }
  });

  if (models.length === 0) {
    throw new Error(
      "Gemini parser extracted zero models. Google may have changed the pricing page structure.",
    );
  }

  for (const model of models) {
    tagModelModality(model);
  }

  return models;
}

/**
 * Public provider interface.
 *
 * Other providers should implement the same shape:
 *
 *   getOpenAIPricing()
 *   getAnthropicPricing()
 *   getMistralPricing()
 *   etc.
 */
export async function getGeminiPricing(): Promise<ProviderPricing> {
  const markdown =
    await fetchGeminiPricingPage();

  const models =
    parseGeminiMarkdown(markdown);

  return {
    provider: PROVIDER,

    source: {
      url: GEMINI_PRICING_URL,
      fetchedAt:
        new Date().toISOString(),
    },

    models,
  };
}