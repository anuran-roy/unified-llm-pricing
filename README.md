# Unified LLM Pricing

Daily TypeScript scraper that normalizes pricing from Google Gemini, OpenAI, Anthropic Claude, Groq, Doubleword, and OpenRouter into `data/pricing.json`.

## Providers

- Google Gemini
- OpenAI
- Anthropic Claude
- Groq
- Doubleword
- OpenRouter

## How it works

- Fetches each provider's pricing source (markdown docs for Gemini/OpenAI/Claude/Groq/Doubleword, the live API for OpenRouter).
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
  - `provider` — provider slug (`google`, `openai`, `anthropic`, `groq`, `doubleword`, `openrouter`).
  - `source.url` / `source.fetchedAt` — where the pricing was scraped from and when.
  - `models[]` — one entry per model.
    - `id` — model ID (e.g. `gemini-3.7-flash`, `gpt-5.6-sol`).
    - `name` — human-readable name.
    - `provider` — provider slug.
    - `tiers[]` — pricing tiers (`standard`, `batch`, `flex`, `fast`, `default`).
      - Each tier has `input`, `output`, `cacheRead`, `cacheWrite`, `other` arrays of prices.
- Each `Price` has `amount`, `currency`, `pricingType` (`token` | `minute` | `hour` | `image` | `request`), `units` (price per `units`, e.g. `1000000` tokens), optional `modality` (`text` | `image` | `audio` | `video`), and `raw` (the original string from the source).

## Run

```bash
npm install
npm run update
```

`npm run update` builds the TypeScript (CommonJS output, no `.js` extensions needed in source imports) and runs the scraper. The GitHub Action runs daily and commits `data/pricing.json` when pricing changes.