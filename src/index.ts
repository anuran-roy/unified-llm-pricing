import fs from "node:fs/promises";
import {
  getClaudePricing,
} from "./providers/claude";
import {
  getDoublewordPricing,
} from "./providers/doubleword";
import {
  getGeminiPricing,
} from "./providers/gemini";
import {
  getGroqPricing,
} from "./providers/groq";
import {
  getOpenAIPricing,
} from "./providers/openai";
import {
  getOpenRouterPricing,
} from "./providers/openrouter";
import type {
  ProviderPricing,
  UnifiedPricing,
} from "./types";

const OUTPUT_FILE =
  "data/pricing.json";

async function main() {
  const providers: ProviderPricing[] = [];
  const startTime = performance.now();

  providers.push(
    await getGeminiPricing(),
  );

  providers.push(
    await getOpenAIPricing(),
  );

  providers.push(
    await getClaudePricing(),
  );

  providers.push(
    await getGroqPricing(),
  );

  providers.push(
    await getDoublewordPricing(),
  );

  providers.push(
    await getOpenRouterPricing(),
  );

  const result: UnifiedPricing = {
    generatedAt:
      new Date().toISOString(),

    providers,
  };

  await fs.mkdir(
    "data",
    { recursive: true },
  );

  await fs.writeFile(
    OUTPUT_FILE,
    JSON.stringify(
      result,
      null,
      2,
    ) + "\n",
    "utf8",
  );

  console.log(
    "Generated unified pricing",
  );

  for (
    const provider of providers
  ) {
    console.log(
      `${provider.provider}: ` +
      `${provider.models.length} models`,
    );
  }

  console.log(`Total time taken = ${performance.now() - startTime}ms`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

