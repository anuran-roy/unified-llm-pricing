# Unified LLM Pricing

Daily TypeScript scraper that normalizes pricing from Google Gemini, OpenAI, Anthropic Claude, Groq, Doubleword, OpenRouter, LiteLLM, Baseten, Wafer, and OrcaRouter into `data/pricing.json` — plus a live dashboard, API, and API reference built on top of it.

- **Raw data:** [`data/pricing.json`](https://raw.githubusercontent.com/anuran-roy/unified-llm-pricing/refs/heads/main/data/pricing.json) (regenerated daily by a GitHub Action)
- **Live dashboard:** <https://unified-llm-pricing.anuran.dev>
- **API docs:** <https://unified-llm-pricing.anuran.dev/docs> (API Reference from [`docs/public/openapi.json`](docs/public/openapi.json))

## Providers

- Google Gemini
- OpenAI
- Anthropic Claude
- Groq
- Doubleword
- OrcaRouter
- OpenRouter
- LiteLLM
- Baseten
- Wafer

## How it works

- Fetches each provider's pricing source (markdown docs for Gemini/OpenAI/Claude/Groq/Doubleword; JSON APIs for OpenRouter, LiteLLM, Wafer, and OrcaRouter; the embedded Next.js flight payload for Baseten).
- Parses the documents with remark (GFM) and normalizes prices into a unified shape: `{ provider, source, models: [{ id, name, provider, tiers: [{ input, output, cacheRead, cacheWrite, other }] }] }`.
- Infers each model's modality (`text`, `image`, `audio`, `video`, `embedding`, `rerank`) with the shared helper in `src/utils/modality.ts`, using explicit signals, architecture fields, and model-ID keywords (e.g. `embed`, `rerank`, `sora`/`veo`/`kling`, `lyria`/`tts`).
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
  - `provider` — provider slug (`openai`, `anthropic`, `google`, `groq`, `doubleword`, `openrouter`, `litellm`, `baseten`, `wafer`, `orcarouter`).
  - `source.url` / `source.fetchedAt` — where the pricing was scraped from and when.
  - `models[]` — one entry per model.
    - `id` — model ID (e.g. `gemini-3.7-flash`, `gpt-5.6-sol`).
    - `name` — human-readable name.
    - `provider` — provider slug.
    - `tiers[]` — pricing tiers (`standard`, `batch`, `flex`, `fast`, `default`).
      - Each tier has `input`, `output`, `cacheRead`, `cacheWrite`, `other` arrays of prices.
- Each `Price` has `amount`, `currency`, `pricingType` (`token` | `image` | `audio` | `video` | `request` | `minute` | `hour` | `character`), `units` (price per `units`, e.g. `1000000` tokens), optional `modality` (`text` | `image` | `audio` | `video` | `embedding` | `rerank`), and `raw` (the original string from the source).

## Dashboard (`docs/`)

A Next.js (App Router) dashboard that reads the latest snapshot from the GitHub raw URL at request time (no build-time coupling to the data).

### Pages

- **Overview** (`/`) — provider/model counts, cheapest models, per-provider stats.
- **Price per 1M tokens** (`/pricing`) — every provider/model pair with input, output, and cache prices; filter by provider/tier/modality multiselect comboboxes, model search, and a model-size slider (incl. a `>1T` category); sortable columns.
- **Availability** (`/availability`) — models grouped by which providers serve them, with per-provider prices per 1M tokens; filter by provider multiselect and minimum provider count.
- **Tier comparison** (`/tier-comparison`) — discount tiers (`batch`, `flex`, …) compared against the standard tier with savings percentages.
- **API docs** (`/docs`) — OpenAPI reference for all API routes.

### API

All filters are plain query params, so every view (including filtered states) is directly shareable — the "Share this data" button in the header copies the current URL, and the top-right button toggles between light/dark/system themes.

| Route                 | Description                                                     |
| --------------------- | --------------------------------------------------------------- |
| `GET /api/stats`      | Dataset overview and per-provider statistics.                   |
| `GET /api/leaderboard`| Every provider/model pair with per-1M-token prices.             |
| `GET /api/availability`| Models grouped by provider availability.                       |
| `GET /api/tiers`      | Discount tiers compared against standard pricing.               |

Common params: `models` (substring), `provider` / `tier` / `modality` (comma-separated, any-of), `minSize` / `maxSize` (billions of params), `sortBy`, `sortOrder`, `limit` (max 1000), `offset`. Full reference at `/docs`.

### Run the dashboard

```bash
cd docs
npm install
npm run dev
```

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
