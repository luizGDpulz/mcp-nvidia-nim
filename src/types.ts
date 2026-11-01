export interface NimConfig {
  apiKey: string;
  baseUrl: string;
  rateLimitRpm: number;
  defaultModel: string;
}

export type MessageRole = "system" | "user" | "assistant";

export interface TextContentPart {
  type: "text";
  text: string;
}

export interface ImageUrlContentPart {
  type: "image_url";
  image_url: {
    url: string; // http(s) URL ou data:image/...;base64,...
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
