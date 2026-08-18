import { getClaudePricing } from "./claude";
import { getDoublewordPricing } from "./doubleword";
import { getGeminiPricing } from "./gemini";
import { getGroqPricing } from "./groq";
import { getOpenAIPricing } from "./openai";
import { getOpenRouterPricing } from "./openrouter";

export const PROVIDER_REGISTRY = {
  openai: getOpenAIPricing,
  claude: getClaudePricing,
  google: getGeminiPricing,
  groq: getGroqPricing,
  doubleword: getDoublewordPricing,
  openrouter: getOpenRouterPricing
}