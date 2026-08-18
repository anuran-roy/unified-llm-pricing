# Unified LLM Pricing

Daily TypeScript scraper that normalizes pricing from Google Gemini, OpenAI, Anthropic Claude, Groq, and Doubleword into `data/pricing.json`.

## Providers

- Google Gemini
- OpenAI
- Anthropic Claude
- Groq
- Doubleword

## Run

```bash
npm install
npm run update
```

The GitHub Action runs daily and commits `data/pricing.json` when pricing changes.
