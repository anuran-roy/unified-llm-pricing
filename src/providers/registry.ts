import { getBasetenPricing } from "./baseten";
import { getClaudePricing } from "./claude";
import { getDoublewordPricing } from "./doubleword";
import { getGeminiPricing } from "./gemini";
import { getGroqPricing } from "./groq";
import { getLiteLLMPricing } from "./litellm";
import { getOpenAIPricing } from "./openai";
import { getOpenRouterPricing } from "./openrouter";
import { getWaferPricing } from "./wafer";

export const PROVIDER_REGISTRY = {
  openai: getOpenAIPricing,
  claude: getClaudePricing,
  google: getGeminiPricing,
  groq: getGroqPricing,
  doubleword: getDoublewordPricing,
  openrouter: getOpenRouterPricing,
  litellm: getLiteLLMPricing,
  baseten: getBasetenPricing,
  wafer: getWaferPricing
}