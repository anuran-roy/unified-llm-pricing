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

import { inferModelModality } from "../utils/modality.js";

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

function parseOpenAIMarkdown(
  markdown: string,
): ModelPricing[] {
  const tree =
    parseMarkdown(markdown);

  const models: ModelPricing[] = [];
  const byId = new Map<
    string,
    ModelPricing
  >();

  /*
   * The pricing document is now organized as
   * tier sections ("Standard pricing data",
   * "Batch pricing data", ...), each followed
   * by a table whose first column is the
   * model ID.
   */
  let currentTier = "standard";

  for (const node of tree.children) {
    if (node.type === "heading") {
      const heading =
        node.children
          .map((x: any) => x.value ?? "")
          .join("")
          .trim();

      const tierMatch =
        heading.match(
          /^(standard|batch|flex|fast)\s+pricing/i,
        );

      currentTier = tierMatch
        ? tierMatch[1].toLowerCase()
        : "standard";

      continue;
    }

    if (node.type !== "table") {
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

    const modalityColumn =
      headers.findIndex((h) =>
        h.includes("modality"),
      );

    for (const row of rows.slice(1)) {
      const id =
        row[0]?.trim() ?? "";

      if (!id) {
        continue;
      }

      const prices: {
        price: Price;
        category:
          | "input"
          | "output"
          | "cacheRead"
          | "cacheWrite"
          | "other";
      }[] = [];

      const modality =
        modalityColumn >= 0
          ? (
              row[modalityColumn] ??
              ""
            )
              .toLowerCase()
              .trim()
          : "text";

      /*
       * The pricing table does not label every row with
       * its modality (e.g. embeddings, audio, video), so
       * infer it from the model ID when the row says text.
       */
      const inferredModality =
        inferModelModality({
          id,
        });

      for (
        let i = 1;
        i < row.length;
        i++
      ) {
        const header =
          headers[i] ?? "";

        const value =
          row[i] ?? "";

        const amount =
          parsePrice(value);

        if (amount === null) {
          continue;
        }

        const price =
          tokenPrice(
            amount,
            value,
          );

        price.modality =
          modality === "text"
            ? inferredModality ??
              "text"
            : modality;

        let category:
          | "input"
          | "output"
          | "cacheRead"
          | "cacheWrite"
          | "other" =
          "other";

        if (
          /cached input|cache hit|cache read/i.test(
            header,
          )
        ) {
          category = "cacheRead";
        } else if (
          /cache write/i.test(
            header,
          )
        ) {
          category = "cacheWrite";
        } else if (
          /input/i.test(header)
        ) {
          category = "input";
        } else if (
          /output/i.test(header)
        ) {
          category = "output";
        }

        prices.push({
          price,
          category,
        });
      }

      if (prices.length === 0) {
        continue;
      }

      let model = byId.get(id);

      if (!model) {
        model = {
          id,
          name: id,
          provider: PROVIDER,
          tiers: [],
        };

        byId.set(id, model);

        models.push(model);
      }

      const tier =
        ensureTier(
          model,
          currentTier,
        );

      for (const {
        price,
        category,
      } of prices) {
        switch (category) {
          case "input":
            tier.input?.push(price);
            break;
          case "output":
            tier.output?.push(price);
            break;
          case "cacheRead":
            tier.cacheRead?.push(
              price,
            );
            break;
          case "cacheWrite":
            tier.cacheWrite?.push(
              price,
            );
            break;
          default:
            tier.other?.push(price);
        }
      }
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