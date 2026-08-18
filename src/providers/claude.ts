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
  "https://platform.claude.com/docs/en/about-claude/pricing.md";

const PROVIDER = "anthropic";

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

function price(
  value: string,
): Price | null {
  const amount =
    parseNumber(
      value.replace(/\$/g, ""),
    );

  if (amount === null) {
    return null;
  }

  return tokenPrice(
    amount,
    value,
  );
}

function parseModelPricingTable(
  rows: string[][],
  models: Map<
    string,
    ModelPricing
  >,
) {
  if (rows.length < 2) {
    return;
  }

  const headers =
    rows[0].map((x) =>
      x.toLowerCase(),
    );

  const modelIndex =
    headers.findIndex((x) =>
      x.includes("model"),
    );

  if (modelIndex < 0) {
    return;
  }

  for (const row of rows.slice(1)) {
    const modelName =
      row[modelIndex]?.trim();

    if (!modelName) {
      continue;
    }

    const id =
      modelName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

    const model: ModelPricing = {
      id,
      name: modelName,
      provider: PROVIDER,
      tiers: [],
    };

    const tier =
      ensureTier(
        model,
        "standard",
      );

    for (
      let i = 0;
      i < headers.length;
      i++
    ) {
      const value = row[i];

      if (!value) {
        continue;
      }

      const p = price(value);

      if (!p) {
        continue;
      }

      const header =
        headers[i];

      if (
        header.includes(
          "base input",
        )
      ) {
        tier.input?.push(p);
      } else if (
        header.includes(
          "output",
        )
      ) {
        tier.output?.push(p);
      } else if (
        header.includes(
          "cache hit",
        ) ||
        header.includes(
          "refresh",
        )
      ) {
        tier.cacheRead?.push(p);
      } else if (
        header.includes(
          "5m cache",
        ) ||
        header.includes(
          "5-minute",
        ) ||
        header.includes(
          "1h cache",
        ) ||
        header.includes(
          "1-hour",
        )
      ) {
        tier.cacheWrite?.push(p);
      }
    }

    models.set(
      modelName,
      model,
    );
  }
}

function parseBatchTable(
  rows: string[][],
  models: Map<
    string,
    ModelPricing
  >,
) {
  if (rows.length < 2) {
    return;
  }

  const headers =
    rows[0].map((x) =>
      x.toLowerCase(),
    );

  const modelIndex =
    headers.findIndex((x) =>
      x.includes("model"),
    );

  const inputIndex =
    headers.findIndex((x) =>
      x.includes("batch input"),
    );

  const outputIndex =
    headers.findIndex((x) =>
      x.includes("batch output"),
    );

  if (
    modelIndex < 0 ||
    inputIndex < 0 ||
    outputIndex < 0
  ) {
    return;
  }

  for (const row of rows.slice(1)) {
    const name =
      row[modelIndex];

    if (!name) {
      continue;
    }

    const model =
      models.get(name);

    /*
     * Batch tables sometimes contain models
     * that aren't in the first table.
     */
    const target =
      model ??
      {
        id: name
          .toLowerCase()
          .replace(
            /[^a-z0-9]+/g,
            "-",
          ),
        name,
        provider: PROVIDER,
        tiers: [],
      };

    const tier =
      ensureTier(
        target,
        "batch",
      );

    const input =
      price(row[inputIndex]);

    const output =
      price(row[outputIndex]);

    if (input) {
      tier.input?.push(input);
    }

    if (output) {
      tier.output?.push(output);
    }

    models.set(
      name,
      target,
    );
  }
}

function parseClaudeMarkdown(
  markdown: string,
): ModelPricing[] {
  const tree =
    parseMarkdown(markdown);

  const models =
    new Map<
      string,
      ModelPricing
    >();

  let inBatchSection =
    false;

  for (const node of tree.children) {
    if (node.type === "heading") {
      const heading =
        node.children
          .map((x: any) =>
            x.value ?? "",
          )
          .join("")
          .trim()
          .toLowerCase();

      inBatchSection =
        heading.includes(
          "batch processing",
        );
    }

    if (node.type === "table") {
      const rows =
        tableRows(node);

      const first =
        rows[0]
          ?.join(" ")
          .toLowerCase();

      if (
        first?.includes(
          "base input",
        )
      ) {
        parseModelPricingTable(
          rows,
          models,
        );
      } else if (
        inBatchSection &&
        first?.includes(
          "batch input",
        )
      ) {
        parseBatchTable(
          rows,
          models,
        );
      }
    }
  }

  if (models.size === 0) {
    throw new Error(
      "Claude parser extracted zero models.",
    );
  }

  return [...models.values()];
}

export async function getClaudePricing():
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
      parseClaudeMarkdown(
        markdown,
      ),
  };
}