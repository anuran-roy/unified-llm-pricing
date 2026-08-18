import fs from "node:fs/promises";
import { PROVIDER_REGISTRY } from "./providers/registry";
import type {
  ProviderPricing,
  UnifiedPricing,
} from "./types";

const OUTPUT_FILE =
  "data/pricing.json";



async function main() {
  const providers: ProviderPricing[] = [];
  const startTime = performance.now();

  for (const getPricing of Object.values(PROVIDER_REGISTRY)) {
    providers.push(await getPricing());
  }

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
    `${JSON.stringify(
      result,
      null,
      2,
    )}\n`,
    "utf8",
  );

  console.log(
    "Generated unified pricing",
  );

  for (
    const provider of providers
  ) {
    console.log(
      `${provider.provider}: ${provider.models.length} models`,
    );
  }

  console.log(`Total time taken = ${((performance.now() - startTime)/1000).toFixed(4)} s`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

