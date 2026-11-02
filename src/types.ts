export interface NimConfig {
  apiKey: string;
  baseUrl: string;
  rateLimitRpm: number;
  defaultModel: string;
  healthCheckEnabled?: boolean;
  minRpmReserve?: number;
  healthCheckCacheTtlMs?: number;
}

export type MessageRole = "system" | "user" | "assistant";

export interface TextContentPart {
  type: "text";
  text: string;
}

export interface ImageUrlContentPart {
  type: "image_url";
  image_url: {
    url: string; // http(s) URL or data:image/...;base64,...
  };
}

export type MessageContent = string | Array<TextContentPart | ImageUrlContentPart>;

export interface ChatMessage {
  role: MessageRole;
  content: MessageContent;
  name?: string;
}

export interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  stream?: boolean;
  stop?: string | string[];
  frequency_penalty?: number;
  presence_penalty?: number;
}

export interface ChatCompletionChoice {
  index: number;
  message: {
    role: MessageRole;
    content: string;
  };
  finish_reason: "stop" | "length" | "content_filter" | null;
}

export interface ChatCompletionUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface ChatCompletionResponse {
  id: string;
  object: "chat.completion";
  created: number;
  model: string;
  choices: ChatCompletionChoice[];
  usage?: ChatCompletionUsage;
}

export interface CompletionWithFallbackResult {
  response: ChatCompletionResponse;
  modelUsed: string;
  requestedModel: string;
  fallbackTriggered: boolean;
  fallbackReason?: string;
  attempts: Array<{ model: string; error?: string }>;
}

export interface NimModelItem {
  id: string;
  object: string;
  created: number;
  owned_by: string;
}

export interface NimModelsListResponse {
  object: "list";
  data: NimModelItem[];
}

export type HealthStatus = "healthy" | "degraded" | "unavailable";

export interface ModelHealthProbeResult {
  model: string;
  alias?: string;
  status: HealthStatus;
  statusCode?: number;
  latencyMs: number;
  error?: string;
}

export interface CatalogHealthReport {
  timestamp: string;
  fromCache: boolean;
  totalTested: number;
  healthyCount: number;
  degradedCount: number;
  unavailableCount: number;
  throttledDueToQuota?: boolean;
  quotaMessage?: string;
  results: ModelHealthProbeResult[];
}
