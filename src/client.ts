import { SlidingWindowRateLimiter, type RateLimiterStatus } from "./rate-limiter.js";
import { MetricsCollector, type TelemetrySummary } from "./metrics.js";
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
  private readonly metrics: MetricsCollector;
  private readonly requestTimeoutMs: number;

  constructor(config: NimConfig, options?: { requestTimeoutMs?: number }) {
    if (!config.apiKey || config.apiKey.trim() === "") {
      throw new NimClientError("NVIDIA API key is required.");
    }
    this.apiKey = config.apiKey.trim();
    this.baseUrl = (config.baseUrl || "https://integrate.api.nvidia.com/v1").replace(/\/+$/, "");
    this.defaultModel = config.defaultModel || "mistralai/mistral-large-4-1t-a52b";
    this.requestTimeoutMs = options?.requestTimeoutMs ?? 90_000;

    const rpm = config.rateLimitRpm > 0 ? config.rateLimitRpm : 40;
    this.rateLimiter = new SlidingWindowRateLimiter({ maxRequests: rpm, windowMs: 60_000 });
    this.metrics = new MetricsCollector();
  }

  public getRateLimiterStatus(): RateLimiterStatus {
    return this.rateLimiter.getStatus();
  }

  public getTelemetry(): TelemetrySummary {
    return this.metrics.getSummary();
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
      throw new NimClientError(`Failed to list models (${response.status}): ${errText}`, response.status);
    }

    return (await response.json()) as NimModelsListResponse;
  }

  public async chatCompletion(
    request: Partial<ChatCompletionRequest> & { messages: ChatMessage[] }
  ): Promise<ChatCompletionResponse> {
    const model = resolveModel(request.model || this.defaultModel);
    const maxRetries = 3;
    const startTime = Date.now();

    // Normalize messages: if model is vision and user provided string content,
    // NVIDIA endpoints require structure [{ type: "text", text: ... }]
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
          const result = (await response.json()) as ChatCompletionResponse;
          this.metrics.recordSuccess(model, Date.now() - startTime, result.usage?.total_tokens);
          return result;
        }

        const errText = await response.text();
        let parsedError: unknown = errText;
        try {
          parsedError = JSON.parse(errText);
        } catch {
          // Keep raw string
        }

        // Retry on 429 Too Many Requests with exponential backoff
        if (response.status === 429 && attempt < maxRetries) {
          attempt++;
          const retryAfterHeader = response.headers.get("retry-after");
          const waitTimeMs = retryAfterHeader
            ? parseInt(retryAfterHeader, 10) * 1000 || 2000 * attempt
            : 2000 * attempt;
          await new Promise((resolve) => setTimeout(resolve, waitTimeMs));
          continue;
        }

        const clientError = new NimClientError(
          `NVIDIA NIM API error [${response.status}] for model '${model}': ${typeof parsedError === "string" ? parsedError : JSON.stringify(parsedError)}`,
          response.status,
          parsedError
        );
        this.metrics.recordFailure(model, Date.now() - startTime, clientError);
        throw clientError;
      } catch (err: unknown) {
        if (err instanceof NimClientError) {
          throw err;
        }
        if (attempt < maxRetries && (err as { name?: string }).name === "TimeoutError") {
          attempt++;
          await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
          continue;
        }
        const commError = new NimClientError(`NVIDIA NIM communication error: ${(err as Error).message}`);
        this.metrics.recordFailure(model, Date.now() - startTime, commError);
        throw commError;
      }
    }

    const maxRetryError = new NimClientError("Maximum retry attempts exceeded for NIM request.");
    this.metrics.recordFailure(model, Date.now() - startTime, maxRetryError);
    throw maxRetryError;
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
      throw new NimClientError("NVIDIA NIM returned an empty response.");
    }

    return choice.message.content;
  }
}
