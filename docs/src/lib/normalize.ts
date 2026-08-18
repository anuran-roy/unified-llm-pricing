import type { ModelPricing, PricingData } from "./types";
import { modelInputPrice } from "./pricing";

const KNOWN_ORGS = new Set([
  "openai",
  "anthropic",
  "google",
  "googleai",
  "meta",
  "meta-llama",
  "meta-models",
  "qwen",
  "deepseek",
  "deepseek-ai",
  "moonshotai",
  "moonshot",
  "z-ai",
  "zai-org",
  "groq",
  "nvidia",
  "tencent",
  "thinkingmachines",
  "canopylabs",
  "minimaxai",
  "minimax",
  "mistralai",
  "mistral",
  "x-ai",
  "amazon",
  "amazonaws",
  "stability",
  "baidu",
  "alibaba",
  "zhipu",
  "black-forest-labs",
  "cohere",
  "snowflake",
  "snowflake-ai",
  "ai21",
  "ai21labs",
  "databricks",
  "dbrx",
  "cerebras",
  "sambanova",
  "upstage",
  "nousresearch",
  "01-ai",
  "inflection",
  "reka",
  "playground",
  "hyperbolic",
  "lmstudio",
  "lmsys",
  "huggingface",
  "hf",
  "bedrock",
  "vertex",
  "azure",
  "together",
  "fireworks",
  "perplexity",
  "kimi",
  "glm",
  "whisper",
  "llama",
  "gpt-oss",
  "groqcloud",
  "smollm",
]);

const QUANTIZATION = /-(fp8|bf16|nvfp4|fp16|awq|int8|int4|w4a16|w8a8|gguf|qlora|exl2|gptq|bitsandbytes)$/;

const ALIASES: Record<string, string> = {
  "glm-52": "glm-5.2",
  "glm-52-fast": "glm-5.2-fast",
  "kimi-k26": "kimi-k2.6",
  "kimi-k27-code": "kimi-k2.7-code",
};

function stripOrg(s: string): string {
  for (const org of KNOWN_ORGS) {
    if (s.startsWith(`${org}/`)) return s.slice(org.length + 1);
    if (s.startsWith(`${org}.`)) return s.slice(org.length + 1);
  }
  return s;
}

export function normalizeModelKey(id: string, knownSlugs?: string[]): string {
  const original = id.trim();
  let s = original.toLowerCase().trim();

  if (knownSlugs && knownSlugs.length > 0) {
    const match = knownSlugs
      .filter((slug) => slug.length >= 8 && s.endsWith(slug))
      .sort((a, b) => b.length - a.length)[0];
    if (match) s = match;
  }

  s = s.replace(/^~/, "");
  s = s.replace(/@[a-z0-9.-]+$/, "");
  s = s.replace(/:[a-z0-9.-]+$/, "");
  s = stripOrg(s);
  s = s.replace(/-\d{6,8}(-v\d+)?$/, "");
  s = s.replace(/-\d{4}$/, "");
  s = s.replace(/-latest$/, "");
  s = s.replace(QUANTIZATION, "");
  s = ALIASES[s] ?? s;
  s = s.replace(/-{2,}/g, "-").replace(/^-|-$/g, "");

  if (s.length < 3) return original.toLowerCase();
  return s;
}

export interface AvailabilityEntry {
  provider: string;
  modelId: string;
  modelName: string;
  input: number | null;
}

export interface AvailabilityCluster {
  key: string;
  displayName: string;
  count: number;
  entries: AvailabilityEntry[];
}

const DISPLAY_PRIORITY = ["openrouter", "wafer", "baseten", "doubleword", "groq", "litellm", "google", "openai", "anthropic"];

const LITELLM_MODES = new Set(["chat", "completion", "responses", "realtime", "text-completion"]);

export function isRelevantModel(model: ModelPricing): boolean {
  if (model.provider === "litellm") {
    const mode = model.metadata?.mode;
    return typeof mode === "string" && LITELLM_MODES.has(mode);
  }
  return true;
}

export function buildAvailability(data: PricingData): AvailabilityCluster[] {
  const knownSlugs: string[] = [];
  for (const provider of data.providers) {
    for (const model of provider.models) {
      if (!isRelevantModel(model)) continue;
      if (model.provider === "openrouter" && typeof model.metadata?.canonicalSlug === "string") {
        knownSlugs.push(model.metadata.canonicalSlug.toLowerCase());
      } else {
        knownSlugs.push(model.id.toLowerCase());
      }
    }
  }

  const clusters = new Map<string, AvailabilityCluster>();
  const byProvider = new Map<string, string[]>();

  for (const provider of data.providers) {
    for (const model of provider.models) {
      if (!isRelevantModel(model)) continue;
      const key = normalizeModelKey(model.id, provider.provider === "groq" ? knownSlugs : undefined);
      let cluster = clusters.get(key);
      if (!cluster) {
        cluster = { key, displayName: model.name, count: 0, entries: [] };
        clusters.set(key, cluster);
      }
      const existing = byProvider.get(key) ?? [];
      if (existing.includes(provider.provider)) continue;
      existing.push(provider.provider);
      byProvider.set(key, existing);
      cluster.count += 1;
      cluster.entries.push({
        provider: provider.provider,
        modelId: model.id,
        modelName: model.name,
        input: modelInputPrice(model),
      });
      if (cluster.count === 1) cluster.displayName = model.name;
      else {
        const prio = (name: string) => {
          const i = DISPLAY_PRIORITY.indexOf(name);
          return i === -1 ? 99 : i;
        };
        const best = [...cluster.entries].sort(
          (a, b) => prio(a.provider) - prio(b.provider) || b.modelName.length - a.modelName.length
        )[0];
        cluster.displayName = best.modelName;
      }
    }
  }

  return [...clusters.values()].sort((a, b) => b.count - a.count || a.displayName.localeCompare(b.displayName));
}