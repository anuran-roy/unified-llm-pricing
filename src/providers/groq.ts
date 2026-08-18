import type {
  ModelPricing,
  Price,
  PricingTier,
  ProviderPricing
} from "../types.js";

import {
  fetchMarkdown,
  parseMarkdown,
  parseNumber,
  tableRows,
} from "../utils/markdown.js";

const URL =
  "https://console.groq.com/docs/models.md";

const PROVIDER = "groq";

function detectPrice(
  value: string,
): Price | null {
  const amount =
    parseNumber(
      value.replace(/\$/g, ""),
    );

  if (amount === null) {
    return null;
  }

  const v =
    value.toLowerCase();

  if (
    v.includes("per hour")
  ) {
    return {
      amount,
      currency: "USD",
      units: 1,
      pricingType: "hour",
      raw: value,
    };
  }

  if (
    v.includes("per 1m characters") ||
    v.includes("per 1 million characters")
  ) {
    return {
      amount,
      currency: "USD",
      units: 1_000_000,
      pricingType: "character",
      raw: value,
    };
  }

  return {
    amount,
    currency: "USD",
    units: 1_000_000,
    pricingType: "token",
    modality: "text",
    raw: value,
  };
}

function ensureTier(
  model: ModelPricing,
): PricingTier {
  let tier =
    model.tiers.find(
      (x) => x.name === "standard",
    );

  if (!tier) {
    tier = {
      name: "standard",
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

function parsePricingCell(
  value: string,
  tier: PricingTier,
) {
  /*
   * Examples:
   *
   * $0.05 input
   * $0.08 output
   *
   * or:
   *
   * $0.111 per hour
   */

  const inputMatches =
    value.matchAll(
      /\$([\d.]+)\s*input/gi,
    );

  for (const match of inputMatches) {
    const raw =
      match[0];

    const p =
      detectPrice(raw);

    if (p) {
      tier.input?.push(p);
    }
  }

  const outputMatches =
    value.matchAll(
      /\$([\d.]+)\s*output/gi,
    );

  for (const match of outputMatches) {
    const raw =
      match[0];

    const p =
      detectPrice(raw);

    if (p) {
      tier.output?.push(p);
    }
  }

  /*
   * Per-hour / character pricing.
   */
  if (
    !/input|output/i.test(
      value,
    )
  ) {
    const p =
      detectPrice(value);

    if (p) {
      tier.other?.push(p);
    }
  }
}

function parseGroqMarkdown(
  markdown: string,
): ModelPricing[] {
  const tree =
    parseMarkdown(markdown);

  const models =
    new Map<
      string,
      ModelPricing
    >();

  for (const node of tree.children) {
    if (
      node.type !== "table"
    ) {
      continue;
    }

    const rows =
      tableRows(node);

    if (rows.length < 2) {
      continue;
    }

    const headers =
      rows[0].map((x) =>
        x.toLowerCase(),
      );

    const modelIndex =
      headers.findIndex((x) =>
        x.includes("model id"),
      );

    const pricingIndex =
      headers.findIndex((x) =>
        x.includes("price per"),
      );

    if (
      modelIndex < 0 ||
      pricingIndex < 0
    ) {
      continue;
    }

    for (const row of rows.slice(1)) {
      const modelId =
        row[modelIndex];

      const pricing =
        row[pricingIndex];

      if (
        !modelId ||
        !pricing
      ) {
        continue;
      }

      const model: ModelPricing =
        models.get(modelId) ??
        {
          id: modelId,
          name: modelId,
          provider: PROVIDER,
          tiers: [],
        };

      const tier =
        ensureTier(model);

      parsePricingCell(
        pricing,
        tier,
      );

      /*
       * Groq's current model page also exposes
       * context/max-output information.
       */
      const contextIndex =
        headers.findIndex((x) =>
          x.includes(
            "context window",
          ),
        );

      if (
        contextIndex >= 0 &&
        row[contextIndex]
      ) {
        model.metadata ??= {};

        model.metadata.contextWindow =
          parseNumber(
            row[contextIndex],
          );
      }

      models.set(
        modelId,
        model,
      );
    }
  }

  if (models.size === 0) {
    throw new Error(
      "Groq parser extracted zero models.",
    );
  }

  return [...models.values()];
}

export async function getGroqPricing():
  Promise<ProviderPricing> {
  const markdown =
    await fetchMarkdown(URL);

  return {
    provider: PROVIDER,

    source: {
      url: URL,
      fetchedAt:
        new Date().toISOString(),
    },

    models:
      parseGroqMarkdown(
        markdown,
      ),
  };
}