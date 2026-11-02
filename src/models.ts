export interface ModelMetadata {
  id: string;
  name: string;
  description: string;
  category: "reasoning" | "general" | "code" | "vision" | "parsing" | "translation" | "safety" | "experimental";
  contextWindow?: number;
  supportsVision?: boolean;
}

export const KNOWN_MODELS: Record<string, ModelMetadata> = {
  // Reasoning & Ultra-scale flagships
  "nvidia/nemotron-3-ultra-550b-a55b": {
    id: "nvidia/nemotron-3-ultra-550b-a55b",
    name: "Nemotron-3 Ultra 550B",
    description: "Massive 550-billion parameter model by NVIDIA for ultra-deep reasoning, complex synthesis, and system architecture.",
    category: "reasoning",
    contextWindow: 131072,
  },
  "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning": {
    id: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
    name: "Nemotron-3 Omni 30B Reasoning",
    description: "NVIDIA-optimized model for rapid analytical reasoning and structured chain-of-thought processing.",
    category: "reasoning",
    contextWindow: 131072,
  },
  "nvidia/nemotron-3.5-lightning-30b-a3b": {
    id: "nvidia/nemotron-3.5-lightning-30b-a3b",
    name: "Nemotron-3.5 Lightning 30B",
    description: "Ultra-fast NVIDIA model for instant responses, categorization, and agile tasks.",
    category: "general",
    contextWindow: 131072,
  },

  // Code & Specialized Engineering
  "mistralai/mistral-large-4-1t-a52b": {
    id: "mistralai/mistral-large-4-1t-a52b",
    name: "Mistral Large 4",
    description: "Mistral AI flagship with state-of-the-art logical reasoning, high-complexity code generation, and multilingual capabilities.",
    category: "general",
    contextWindow: 128000,
  },
  "poolside/laguna-xs-2.1": {
    id: "poolside/laguna-xs-2.1",
    name: "Poolside Laguna XS 2.1",
    description: "Specialized model for software engineering, refactoring, and code audits created by Poolside AI.",
    category: "code",
    contextWindow: 32768,
  },

  // Computer Vision & Multimodal
  "meta/llama-3.2-90b-vision-instruct": {
    id: "meta/llama-3.2-90b-vision-instruct",
    name: "Llama 3.2 90B Vision",
    description: "90-billion parameter multimodal model by Meta for in-depth analysis of images, screenshots, wireframes, and diagrams.",
    category: "vision",
    contextWindow: 131072,
    supportsVision: true,
  },
  "nvidia/nemotron-3.5-super-vl-120b-a12b": {
    id: "nvidia/nemotron-3.5-super-vl-120b-a12b",
    name: "Nemotron-3.5 Super VL 120B",
    description: "Massive Vision-Language multimodal model by NVIDIA for technical visual inspection.",
    category: "vision",
    contextWindow: 131072,
    supportsVision: true,
  },

  // Documents & Parsing
  "nvidia/nemotron-parse-2.0": {
    id: "nvidia/nemotron-parse-2.0",
    name: "Nemotron Parse 2.0",
    description: "Specialist in OCR, semantic extraction, and converting complex documents, PDFs, tables, and unstructured text into clean Markdown.",
    category: "parsing",
    contextWindow: 32768,
  },

  // Translation
  "nvidia/riva-translate-4b-instruct-v2": {
    id: "nvidia/riva-translate-4b-instruct-v2",
    name: "Riva Translate 4B",
    description: "NVIDIA model optimized for high-precision technical multilingual translation.",
    category: "translation",
    contextWindow: 16384,
  },

  // Speed & Multimodal
  "minimaxai/minimax-m3.1-flash": {
    id: "minimaxai/minimax-m3.1-flash",
    name: "MiniMax M3.1 Flash",
    description: "Low-latency, high-throughput model for agile and instant completions.",
    category: "general",
    contextWindow: 65536,
  },
  "google/diffusiongemma-26b-a4b-it": {
    id: "google/diffusiongemma-26b-a4b-it",
    name: "Diffusion Gemma 26B",
    description: "Experimental Gemma family model for visual diffusion and synthesis tasks.",
    category: "experimental",
    contextWindow: 8192,
  },

  // Safety & Guardrails
  "nvidia/llama-3.1-nemotron-safety-guard-8b-v3": {
    id: "nvidia/llama-3.1-nemotron-safety-guard-8b-v3",
    name: "Nemotron Safety Guard 8B",
    description: "NVIDIA guardrail model for content compliance, toxicity detection, and safety verification.",
    category: "safety",
    contextWindow: 8192,
  },
};

export const MODEL_ALIASES: Record<string, string> = {
  // Default / Recommended
  default: "mistralai/mistral-large-4-1t-a52b",

  // Reasoning & Architecture
  reasoning: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
  "nemotron-reasoning": "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
  ultra: "nvidia/nemotron-3-ultra-550b-a55b",
  "nemotron-ultra": "nvidia/nemotron-3-ultra-550b-a55b",
  nemotron: "nvidia/nemotron-3-ultra-550b-a55b",

  // Velocity
  fast: "nvidia/nemotron-3.5-lightning-30b-a3b",
  lightning: "nvidia/nemotron-3.5-lightning-30b-a3b",
  flash: "minimaxai/minimax-m3.1-flash",

  // Code
  code: "poolside/laguna-xs-2.1",
  laguna: "poolside/laguna-xs-2.1",
  "mistral-code": "mistralai/mistral-large-4-1t-a52b",
  mistral: "mistralai/mistral-large-4-1t-a52b",

  // Vision
  vision: "meta/llama-3.2-90b-vision-instruct",
  "llama-vision": "meta/llama-3.2-90b-vision-instruct",
  "super-vl": "nvidia/nemotron-3.5-super-vl-120b-a12b",

  // Utility tasks
  parse: "nvidia/nemotron-parse-2.0",
  translate: "nvidia/riva-translate-4b-instruct-v2",
  guard: "nvidia/llama-3.1-nemotron-safety-guard-8b-v3",
  diffusion: "google/diffusiongemma-26b-a4b-it",
};

/**
 * Ordered fallback redundancy chains per model ID.
 * If the primary model fails with an unrecoverable error (e.g. 404 decommissioned, 403, 410),
 * the client gracefully fails over to the next model in the chain.
 */
export const MODEL_FALLBACK_CHAINS: Record<string, string[]> = {
  // Code engineering fallback: Poolside Laguna -> Mistral Large 4
  "poolside/laguna-xs-2.1": [
    "mistralai/mistral-large-4-1t-a52b",
    "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
  ],

  // Ultra reasoning fallback: Nemotron Ultra 550B -> Omni Reasoning 30B -> Mistral Large 4
  "nvidia/nemotron-3-ultra-550b-a55b": [
    "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
    "mistralai/mistral-large-4-1t-a52b",
  ],

  // Fast reasoning fallback: Omni Reasoning 30B -> Mistral Large 4 -> Nemotron Ultra
  "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning": [
    "mistralai/mistral-large-4-1t-a52b",
    "nvidia/nemotron-3-ultra-550b-a55b",
  ],

  // Vision fallback: Llama 3.2 90B Vision -> Nemotron Super VL 120B
  "meta/llama-3.2-90b-vision-instruct": [
    "nvidia/nemotron-3.5-super-vl-120b-a12b",
  ],
  "nvidia/nemotron-3.5-super-vl-120b-a12b": [
    "meta/llama-3.2-90b-vision-instruct",
  ],

  // Speed fallback: Lightning 30B -> MiniMax Flash -> Mistral Large
  "nvidia/nemotron-3.5-lightning-30b-a3b": [
    "minimaxai/minimax-m3.1-flash",
    "mistralai/mistral-large-4-1t-a52b",
  ],
  "minimaxai/minimax-m3.1-flash": [
    "nvidia/nemotron-3.5-lightning-30b-a3b",
    "mistralai/mistral-large-4-1t-a52b",
  ],

  // Parsing fallback: Nemotron Parse 2.0 -> Mistral Large 4
  "nvidia/nemotron-parse-2.0": [
    "mistralai/mistral-large-4-1t-a52b",
  ],

  // Mistral Large fallback: Mistral Large -> Omni Reasoning 30B
  "mistralai/mistral-large-4-1t-a52b": [
    "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
    "nvidia/nemotron-3-ultra-550b-a55b",
  ],
};

export function resolveModel(nameOrAlias?: string): string {
  if (!nameOrAlias || nameOrAlias.trim() === "") {
    return MODEL_ALIASES.default;
  }
  const clean = nameOrAlias.trim().toLowerCase();
  if (MODEL_ALIASES[clean]) {
    return MODEL_ALIASES[clean];
  }
  return nameOrAlias.trim();
}

/**
 * Returns the candidate chain for a requested model or alias: [primaryModel, ...fallbacks]
 */
export function getModelFallbackChain(nameOrAlias?: string): string[] {
  const primary = resolveModel(nameOrAlias);
  const fallbacks = MODEL_FALLBACK_CHAINS[primary] || [];
  // Ensure primary is first and remove any duplicate entries
  return Array.from(new Set([primary, ...fallbacks]));
}
