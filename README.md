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

## Run

```bash
npm install
npm run update
```

`npm run update` builds the TypeScript (CommonJS output, no `.js` extensions needed in source imports) and runs the scraper. The GitHub Action runs daily and commits `data/pricing.json` when pricing changes.