import { SlidingWindowRateLimiter, type RateLimiterStatus } from "./rate-limiter.js";
import { resolveModel } from "./models.js";
import type {
  NimConfig,
  ChatCompletionRequest,
  ChatCompletionResponse,
  NimModelsListResponse,
  ChatMessage,
} from "./types.js";

export class NimClientError extends Error {
  public statusCode?: number;
  public details?: unknown;

  constructor(message: string, statusCode?: number, details?: unknown) {
    super(message);
    this.name = "NimClientError";
    this.statusCode = statusCode;
    this.details = details;
  }
}

export class NimClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly defaultModel: string;
  private readonly rateLimiter: SlidingWindowRateLimiter;
  private readonly requestTimeoutMs: number;

  constructor(config: NimConfig, options?: { requestTimeoutMs?: number }) {
    if (!config.apiKey || config.apiKey.trim() === "") {
      throw new NimClientError("NVIDIA API key é obrigatória.");
    }
    this.apiKey = config.apiKey.trim();
    this.baseUrl = (config.baseUrl || "https://integrate.api.nvidia.com/v1").replace(/\/+$/, "");
    this.defaultModel = config.defaultModel || "mistralai/mistral-large-4-1t-a52b";
    this.requestTimeoutMs = options?.requestTimeoutMs ?? 90_000;

    const rpm = config.rateLimitRpm > 0 ? config.rateLimitRpm : 40;
    this.rateLimiter = new SlidingWindowRateLimiter({ maxRequests: rpm, windowMs: 60_000 });
  }

  public getRateLimiterStatus(): RateLimiterStatus {
    return this.rateLimiter.getStatus();
  }

  public async listModels(): Promise<NimModelsListResponse> {
    await this.rateLimiter.acquire();

    const response = await fetch(`${this.baseUrl}/models`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(this.requestTimeoutMs),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new NimClientError(`Falha ao listar modelos (${response.status}): ${errText}`, response.status);
    }

    return (await response.json()) as NimModelsListResponse;
  }

  public async chatCompletion(
    request: Partial<ChatCompletionRequest> & { messages: ChatMessage[] }
  ): Promise<ChatCompletionResponse> {
    const model = resolveModel(request.model || this.defaultModel);
    const maxRetries = 3;

    // Normaliza mensagens: se o modelo for multimodal/vision e o usuário passou texto puro,
    // alguns endpoints da NVIDIA exigem estrutura [{ type: "text", text: ... }]
    const normalizedMessages: ChatMessage[] = request.messages.map((msg) => {
      if (typeof msg.content === "string" && model.includes("vision")) {
        return {
          ...msg,
          content: [{ type: "text", text: msg.content }],
        };
      }
      return msg;
    });

    const payload: ChatCompletionRequest = {
      model,
      messages: normalizedMessages,
      temperature: request.temperature ?? 0.2,
      top_p: request.top_p ?? 0.7,
      max_tokens: request.max_tokens ?? 2048,
      stream: false,
      ...(request.stop ? { stop: request.stop } : {}),
    };

    let attempt = 0;
    while (attempt <= maxRetries) {
      await this.rateLimiter.acquire();

      try {
        const response = await fetch(`${this.baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(this.requestTimeoutMs),
        });

        if (response.ok) {
          return (await response.json()) as ChatCompletionResponse;
        }

        const errText = await response.text();
        let parsedError: unknown = errText;
        try {
          parsedError = JSON.parse(errText);
        } catch {
          // Mantém string original
        }

        // Se bater no 429 (Rate Limit na NVIDIA), tenta backoff
        if (response.status === 429 && attempt < maxRetries) {
          attempt++;
          const retryAfterHeader = response.headers.get("retry-after");
          const waitTimeMs = retryAfterHeader
            ? parseInt(retryAfterHeader, 10) * 1000 || 2000 * attempt
            : 2000 * attempt;
          await new Promise((resolve) => setTimeout(resolve, waitTimeMs));
          continue;
        }

        throw new NimClientError(
          `Erro na API NVIDIA NIM [${response.status}] para modelo '${model}': ${typeof parsedError === "string" ? parsedError : JSON.stringify(parsedError)}`,
          response.status,
          parsedError
        );
      } catch (err: unknown) {
        if (err instanceof NimClientError) {
          throw err;
        }
        if (attempt < maxRetries && (err as { name?: string }).name === "TimeoutError") {
          attempt++;
          await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
          continue;
        }
        throw new NimClientError(`Erro de comunicação com NVIDIA NIM: ${(err as Error).message}`);
      }
    }

    throw new NimClientError("Número máximo de tentativas excedido para requisição NIM.");
  }

  public async quickPrompt(
    prompt: string,
    options?: {
      model?: string;
      systemPrompt?: string;
      temperature?: number;
      maxTokens?: number;
    }
  ): Promise<string> {
    const messages: ChatMessage[] = [];
    if (options?.systemPrompt) {
      messages.push({ role: "system", content: options.systemPrompt });
    }
    messages.push({ role: "user", content: prompt });

    const response = await this.chatCompletion({
      model: options?.model,
      messages,
      temperature: options?.temperature,
      max_tokens: options?.maxTokens,
    });

    const choice = response.choices?.[0];
    if (!choice || !choice.message?.content) {
      throw new NimClientError("NVIDIA NIM retornou resposta vazia.");
    }

    return choice.message.content;
  }
}
