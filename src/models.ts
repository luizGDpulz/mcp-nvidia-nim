export interface ModelMetadata {
  id: string;
  name: string;
  description: string;
  category: "reasoning" | "general" | "code" | "vision" | "parsing" | "translation" | "safety" | "experimental";
  contextWindow?: number;
  supportsVision?: boolean;
}

export const KNOWN_MODELS: Record<string, ModelMetadata> = {
  // Flagships de Raciocínio & Ultra escala
  "nvidia/nemotron-3-ultra-550b-a55b": {
    id: "nvidia/nemotron-3-ultra-550b-a55b",
    name: "Nemotron-3 Ultra 550B",
    description: "Modelo massivo de 550 bilhões de parâmetros da NVIDIA para raciocínio ultra profundo, síntese complexa e arquitetura.",
    category: "reasoning",
    contextWindow: 131072,
  },
  "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning": {
    id: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
    name: "Nemotron-3 Omni 30B Reasoning",
    description: "Modelo otimizado da NVIDIA para raciocínio analítico rápido e cadeias de pensamento estruturadas.",
    category: "reasoning",
    contextWindow: 131072,
  },
  "nvidia/nemotron-3.5-lightning-30b-a3b": {
    id: "nvidia/nemotron-3.5-lightning-30b-a3b",
    name: "Nemotron-3.5 Lightning 30B",
    description: "Modelo ultra veloz da NVIDIA para respostas instantâneas, categorização e tarefas ágeis.",
    category: "general",
    contextWindow: 131072,
  },

  // Código & Engenharia Especializada
  "mistralai/mistral-large-4-1t-a52b": {
    id: "mistralai/mistral-large-4-1t-a52b",
    name: "Mistral Large 4",
    description: "Flagship da Mistral AI com raciocínio lógico de ponta, geração de código de alta complexidade e suporte multilíngue.",
    category: "general",
    contextWindow: 128000,
  },
  "poolside/laguna-xs-2.1": {
    id: "poolside/laguna-xs-2.1",
    name: "Poolside Laguna XS 2.1",
    description: "Modelo especializado em engenharia de software, refatoração e auditoria de código criado pela Poolside AI.",
    category: "code",
    contextWindow: 32768,
  },

  // Visão Computacional & Multimodal
  "meta/llama-3.2-90b-vision-instruct": {
    id: "meta/llama-3.2-90b-vision-instruct",
    name: "Llama 3.2 90B Vision",
    description: "Modelo multimodal de 90 bilhões de parâmetros da Meta para análise profunda de imagens, prints, wireframes e diagramas.",
    category: "vision",
    contextWindow: 131072,
    supportsVision: true,
  },
  "nvidia/nemotron-3.5-super-vl-120b-a12b": {
    id: "nvidia/nemotron-3.5-super-vl-120b-a12b",
    name: "Nemotron-3.5 Super VL 120B",
    description: "Modelo massivo multimodal Vision-Language da NVIDIA para inspeção técnica e visual.",
    category: "vision",
    contextWindow: 131072,
    supportsVision: true,
  },

  // Documentos & Parsing
  "nvidia/nemotron-parse-2.0": {
    id: "nvidia/nemotron-parse-2.0",
    name: "Nemotron Parse 2.0",
    description: "Especialista em OCR, extração e conversão de documentos complexos, PDFs, tabelas e markdown estruturado.",
    category: "parsing",
    contextWindow: 32768,
  },

  // Tradução
  "nvidia/riva-translate-4b-instruct-v2": {
    id: "nvidia/riva-translate-4b-instruct-v2",
    name: "Riva Translate 4B",
    description: "Modelo otimizado pela NVIDIA para tradução multilíngue de alta precisão técnica.",
    category: "translation",
    contextWindow: 16384,
  },

  // Agilidade & Multimodal
  "minimaxai/minimax-m3.1-flash": {
    id: "minimaxai/minimax-m3.1-flash",
    name: "MiniMax M3.1 Flash",
    description: "Modelo de baixa latência e alto throughput para consultas instantâneas.",
    category: "general",
    contextWindow: 65536,
  },
  "google/diffusiongemma-26b-a4b-it": {
    id: "google/diffusiongemma-26b-a4b-it",
    name: "Diffusion Gemma 26B",
    description: "Modelo experimental da família Gemma para síntese e difusão visual.",
    category: "experimental",
    contextWindow: 8192,
  },

  // Moderação & Guardrails
  "nvidia/llama-3.1-nemotron-safety-guard-8b-v3": {
    id: "nvidia/llama-3.1-nemotron-safety-guard-8b-v3",
    name: "Nemotron Safety Guard 8B",
    description: "Guardrail da NVIDIA para análise de conformidade, toxicidade e segurança.",
    category: "safety",
    contextWindow: 8192,
  },
};

export const MODEL_ALIASES: Record<string, string> = {
  // Padrão / Recomendado
  default: "mistralai/mistral-large-4-1t-a52b",

  // Raciocínio & Arquitetura
  reasoning: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
  "nemotron-reasoning": "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
  ultra: "nvidia/nemotron-3-ultra-550b-a55b",
  "nemotron-ultra": "nvidia/nemotron-3-ultra-550b-a55b",
  nemotron: "nvidia/nemotron-3-ultra-550b-a55b",

  // Velocidade
  fast: "nvidia/nemotron-3.5-lightning-30b-a3b",
  lightning: "nvidia/nemotron-3.5-lightning-30b-a3b",
  flash: "minimaxai/minimax-m3.1-flash",

  // Código
  code: "poolside/laguna-xs-2.1",
  laguna: "poolside/laguna-xs-2.1",
  "mistral-code": "mistralai/mistral-large-4-1t-a52b",
  mistral: "mistralai/mistral-large-4-1t-a52b",

  // Visão
  vision: "meta/llama-3.2-90b-vision-instruct",
  "llama-vision": "meta/llama-3.2-90b-vision-instruct",
  "super-vl": "nvidia/nemotron-3.5-super-vl-120b-a12b",

  // Tarefas utilitárias
  parse: "nvidia/nemotron-parse-2.0",
  translate: "nvidia/riva-translate-4b-instruct-v2",
  guard: "nvidia/llama-3.1-nemotron-safety-guard-8b-v3",
  diffusion: "google/diffusiongemma-26b-a4b-it",
};

export function resolveModel(nameOrAlias?: string): string {
  if (!nameOrAlias || nameOrAlias.trim() === "") {
    return MODEL_ALIASES.default;
  }
  const clean = nameOrAlias.trim().toLowerCase();
  if (MODEL_ALIASES[clean]) {
    return MODEL_ALIASES[clean];
  }
  // Se for um modelo completo (ex: mistralai/... ou outro), retorna direto
  return nameOrAlias.trim();
}
