import type {
  ModelPricing,
  Price,
  PricingTier,
  ProviderPricing,
} from "../types.js";

import {
  fetchMarkdown,
  parseMarkdown,
  parseNumber,
  tableRows,
} from "../utils/markdown.js";

const URL =
  "https://developers.openai.com/api/docs/pricing.md";

const PROVIDER = "openai";

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

function extractModelId(
  value: string,
): string | null {
  /*
   * OpenAI pricing headings commonly contain
   * model IDs such as:
   *
   * GPT-5.5
   * gpt-5.5
   * GPT-4o
   * o3-mini
   */
  const match = value.match(
    /`([a-zA-Z0-9][a-zA-Z0-9._:-]*)`/,
  );

  return (
    match?.[1] ??
    value
      .toLowerCase()
      .replace(/[^a-z0-9._:-]+/g, "-")
      .replace(/^-|-$/g, "")
  );
}

function parsePrice(
  value: string,
): number | null {
  return parseNumber(
    value
      .replace(/\$/g, "")
      .replace(/\/\s*1M tokens?/gi, ""),
  );
}

function ensureTier(
  model: ModelPricing,
  name: string,
): PricingTier {
  let tier = model.tiers.find(
    (t) => t.name === name,
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

function parsePricingTable(
  rows: string[][],
  model: ModelPricing,
  tierName: string,
) {
  if (rows.length < 2) {
    return;
  }

  const headers =
    rows[0].map((x) =>
      x.toLowerCase(),
    );

  const tier =
    ensureTier(model, tierName);

  for (const row of rows.slice(1)) {
    const label =
      row[0]?.toLowerCase() ?? "";

    for (
      let i = 1;
      i < row.length;
      i++
    ) {
      const header =
        headers[i] ?? "";

      const value = row[i];

      if (!value) {
        continue;
      }

      const amount =
        parsePrice(value);

      if (amount === null) {
        continue;
      }

      const price =
        tokenPrice(amount, value);

      if (
        /cached input|cache hit|cache read/i.test(
          label + " " + header,
        )
      ) {
        tier.cacheRead?.push(
          price,
        );
      } else if (
        /cache write/i.test(
          label + " " + header,
        )
      ) {
        tier.cacheWrite?.push(
          price,
        );
      } else if (
        /input/i.test(
          label + " " + header,
        )
      ) {
        tier.input?.push(price);
      } else if (
        /output/i.test(
          label + " " + header,
        )
      ) {
        tier.output?.push(price);
      } else {
        tier.other?.push(price);
      }
    }
  }
}

function parseOpenAIMarkdown(
  markdown: string,
): ModelPricing[] {
  const tree =
    parseMarkdown(markdown);

  const models: ModelPricing[] = [];

  let currentModel:
    | ModelPricing
    | null = null;

  let currentTier =
    "standard";

  for (const node of tree.children) {
    if (node.type === "heading") {
      const heading =
        node.children
          .map((x: any) => x.value ?? "")
          .join("")
          .trim();

      const modelId =
        extractModelId(heading);

      /*
       * Don't treat generic pricing sections
       * as models.
       */
      if (
        modelId &&
        !/pricing|api|batch|cache/i.test(
          heading,
        )
      ) {
        currentModel = {
          id: modelId,
          name: heading,
          provider: PROVIDER,
          tiers: [],
        };

        models.push(currentModel);

        currentTier =
          "standard";

        ensureTier(
          currentModel,
          currentTier,
        );

        continue;
      }

      if (
        /^(batch|flex|standard)$/i.test(
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
      parsePricingTable(
        tableRows(node),
        currentModel,
        currentTier,
      );
    }
  }

  if (models.length === 0) {
    throw new Error(
      "OpenAI parser extracted zero models. " +
      "The pricing document structure may have changed.",
    );
  }

  return models;
}

export async function getOpenAIPricing():
  Promise<ProviderPricing> {
  const markdown =
    await fetchMarkdown(URL);

  const models =
    parseOpenAIMarkdown(markdown);

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