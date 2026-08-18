# Unified LLM Pricing

Daily TypeScript scraper that normalizes pricing from Google Gemini, OpenAI, Anthropic Claude, Groq, Doubleword, OpenRouter, LiteLLM, Baseten, and Wafer into `data/pricing.json`.

## Providers

- Google Gemini
- OpenAI
- Anthropic Claude
- Groq
- Doubleword
- OpenRouter
- LiteLLM model catalog
- Baseten
- Wafer

## How it works

- Fetches each provider's pricing source (markdown docs for Gemini/OpenAI/Claude/Groq/Doubleword; JSON APIs for OpenRouter, LiteLLM, and Wafer; the embedded Next.js flight payload for Baseten).
- Parses the documents with remark (GFM) and normalizes prices into a unified shape: `{ provider, source, models: [{ id, name, provider, tiers: [{ input, output, cacheRead, cacheWrite, other }] }] }`.
- Writes the result to `data/pricing.json`.

## Consume

Ingest the latest snapshot directly:

```bash
curl https://raw.githubusercontent.com/anuran-roy/unified-llm-pricing/refs/heads/main/data/pricing.json
```

```json
{
  "generatedAt": "2026-08-18T20:22:27.256Z",
  "providers": [
    {
      "provider": "google",
      "source": {
        "url": "https://ai.google.dev/gemini-api/docs/pricing.md.txt",
        "fetchedAt": "2026-08-18T20:22:11.402Z"
      },
      "models": [
        {
          "id": "gemini-3.7-flash",
          "name": "Gemini 3.7 Flash",
          "provider": "google",
          "tiers": [
            {
              "name": "standard",
              "input": [
                {
                  "amount": 0.75,
                  "currency": "USD",
                  "pricingType": "token",
                  "units": 1000000,
                  "raw": "$0.75 through December 31, 2026. $1.50 starting January 1, 2027."
                }
              ],
              "output": [],
              "cacheRead": [],
              "cacheWrite": [],
              "other": []
            }
          ]
        }
      ]
    }
  ]
}
```

### Data format

- `generatedAt` — ISO timestamp of when the snapshot was generated.
- `providers[]` — one entry per provider.
  - `provider` — provider slug (`google`, `openai`, `anthropic`, `groq`, `doubleword`, `openrouter`, `litellm`, `baseten`, `wafer`).
  - `source.url` / `source.fetchedAt` — where the pricing was scraped from and when.
  - `models[]` — one entry per model.
    - `id` — model ID (e.g. `gemini-3.7-flash`, `gpt-5.6-sol`).
    - `name` — human-readable name.
    - `provider` — provider slug.
    - `tiers[]` — pricing tiers (`standard`, `batch`, `flex`, `fast`, `default`).
      - Each tier has `input`, `output`, `cacheRead`, `cacheWrite`, `other` arrays of prices.
- Each `Price` has `amount`, `currency`, `pricingType` (`token` | `minute` | `hour` | `image` | `request`), `units` (price per `units`, e.g. `1000000` tokens), optional `modality` (`text` | `image` | `audio` | `video`), and `raw` (the original string from the source).

## Contributing

### Reporting Errata
Please open issues to report errors. We're parsing loads of data, so any help is welcome!

### Adding a provider

The pipeline is driven by `src/providers/registry.ts` — `src/index.ts` iterates `PROVIDER_REGISTRY`, so registering a provider is the only wiring needed (the GitHub Action picks it up automatically).

**Important: keep the types the same.** Every provider must return the exact `ProviderPricing` shape from `src/types.ts`. Do not add provider-specific fields to `ModelPricing`/`Price`/`PricingTier`; anything extra goes in the optional `metadata`/`endpoints` fields. Consumers of `data/pricing.json` rely on the shared contract.

#### 1. Create `src/providers/<name>.ts`

```ts
import type {
  ModelPricing,
  ProviderPricing,
} from "../types";

const PROVIDER = "myprovider";
const URL = "https://example.com/pricing.md";

export async function getMyProviderPricing(): Promise<ProviderPricing> {
  const models: ModelPricing[] = [
    {
      id: "my-model-1",
      name: "My Model 1",
      provider: PROVIDER,
      tiers: [
        {
          name: "standard",
          input: [
            {
              amount: 1.5,
              currency: "USD",
              pricingType: "token",
              units: 1_000_000,
            },
          ],
          output: [],
          cacheRead: [],
          cacheWrite: [],
          other: [],
        },
      ],
    },
  ];

  return {
    provider: PROVIDER,
    source: {
      url: URL,
      fetchedAt: new Date().toISOString(),
    },
    models,
  };
}
```

Contract:

- The exported function must return `Promise<ProviderPricing>` (`{ provider, source: { url, fetchedAt }, models: ModelPricing[] }`).
- Use `pricingType` + `units` to express the price basis (`"token"` with `units: 1_000_000` for per-1M-token prices, `"request"` with `units: 1_000`, `"minute"`/`"hour"`/`"image"` with `units: 1`, etc.).
- Keep the tier buckets semantic: `input`, `output`, `cacheRead`, `cacheWrite`, `other`.
- Relative imports need no `.js` extension (the build emits CommonJS).

#### 2. Register it in `src/providers/registry.ts`

```ts
import { getMyProviderPricing } from "./myprovider";

export const PROVIDER_REGISTRY = {
  // ...existing providers
  myprovider: getMyProviderPricing,
};
```

#### 3. Verify

```bash
npm run build
npm start
```

The new provider should appear in the console summary (`myprovider: N models`) and in `data/pricing.json`.

## Run

```bash
npm install
npm run update
```

`npm run update` builds the TypeScript (CommonJS output, no `.js` extensions needed in source imports) and runs the scraper. The GitHub Action runs daily and commits `data/pricing.json` when pricing changes.