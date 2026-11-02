import { SlidingWindowRateLimiter, type RateLimiterStatus } from "./rate-limiter.js";
import { MetricsCollector, type TelemetrySummary } from "./metrics.js";
import { resolveModel, getModelFallbackChain, KNOWN_MODELS } from "./models.js";
import type {
  NimConfig,
  ChatCompletionRequest,
  ChatCompletionResponse,
  NimModelsListResponse,
  ChatMessage,
  CompletionWithFallbackResult,
  ModelHealthProbeResult,
  CatalogHealthReport,
} from "./types.js";

export class NimClientError extends Error {
  public statusCode?: number;
  public details?: unknown;
  public isModelUnavailable?: boolean;

  constructor(message: string, statusCode?: number, details?: unknown) {
    super(message);
    this.name = "NimClientError";
    this.statusCode = statusCode;
    this.details = details;
    this.isModelUnavailable = statusCode === 404 || statusCode === 403 || statusCode === 410;
  }
}

export class NimClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly defaultModel: string;
  private readonly rateLimiter: SlidingWindowRateLimiter;
  private readonly metrics: MetricsCollector;
  private readonly requestTimeoutMs: number;

  // Quota & Health Check Protection settings
  private readonly healthCheckEnabled: boolean;
  private readonly minRpmReserve: number;
  private readonly healthCheckCacheTtlMs: number;
  private cachedHealthReport: CatalogHealthReport | null = null;

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

    // Default protection settings:
    // 1. healthCheckEnabled: true (can be disabled via env)
    // 2. minRpmReserve: 15 slots floor (at least 15 slots reserved for real queries)
    // 3. healthCheckCacheTtlMs: 10 minutes cache
    this.healthCheckEnabled = config.healthCheckEnabled ?? true;
    this.minRpmReserve = config.minRpmReserve ?? 15;
    this.healthCheckCacheTtlMs = config.healthCheckCacheTtlMs ?? 10 * 60 * 1000;
  }

  public getRateLimiterStatus(): RateLimiterStatus {
    return this.rateLimiter.getStatus();
  }

  public getTelemetry(): TelemetrySummary {
    return this.metrics.getSummary();
  }

  public getProtectionConfig() {
    return {
      healthCheckEnabled: this.healthCheckEnabled,
      minRpmReserve: this.minRpmReserve,
      healthCheckCacheTtlMs: this.healthCheckCacheTtlMs,
      hasCachedHealthReport: !!this.cachedHealthReport,
    };
  }

  /**
   * Passively updates health cache based on real traffic, requiring 0 extra synthetic probe requests.
   */
  private updatePassiveHealth(model: string, status: "healthy" | "unavailable", latencyMs: number, error?: string): void {
    if (!this.cachedHealthReport) return;
    const existing = this.cachedHealthReport.results.find((r) => r.model === model);
    if (existing) {
      existing.status = status;
      existing.latencyMs = latencyMs;
      existing.error = error;
    } else {
      this.cachedHealthReport.results.push({
        model,
        status,
        latencyMs,
        error,
      });
    }
    this.cachedHealthReport.healthyCount = this.cachedHealthReport.results.filter((r) => r.status === "healthy").length;
    this.cachedHealthReport.unavailableCount = this.cachedHealthReport.results.filter((r) => r.status === "unavailable").length;
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

    // Normalize messages: vision models require [{ type: "text", text: ... }] structure
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
          const latency = Date.now() - startTime;
          this.metrics.recordSuccess(model, latency, result.usage?.total_tokens);
          this.updatePassiveHealth(model, "healthy", latency);
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
        const latency = Date.now() - startTime;
        this.metrics.recordFailure(model, latency, clientError);
        this.updatePassiveHealth(model, "unavailable", latency, clientError.message);
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
        const latency = Date.now() - startTime;
        const commError = new NimClientError(`NVIDIA NIM communication error: ${(err as Error).message}`);
        this.metrics.recordFailure(model, latency, commError);
        this.updatePassiveHealth(model, "unavailable", latency, commError.message);
        throw commError;
      }
    }

    const maxRetryError = new NimClientError("Maximum retry attempts exceeded for NIM request.");
    this.metrics.recordFailure(model, Date.now() - startTime, maxRetryError);
    throw maxRetryError;
  }

  /**
   * Executes chat completion traversing the model's fallback chain if unrecoverable errors occur.
   */
  public async chatCompletionWithFallback(
    request: Partial<ChatCompletionRequest> & { messages: ChatMessage[] }
  ): Promise<CompletionWithFallbackResult> {
    const primaryCandidate = resolveModel(request.model || this.defaultModel);
    const candidateChain = getModelFallbackChain(request.model || this.defaultModel);
    const attempts: Array<{ model: string; error?: string }> = [];

    let lastError: Error | null = null;

    for (let i = 0; i < candidateChain.length; i++) {
      const candidate = candidateChain[i];
      try {
        const response = await this.chatCompletion({
          ...request,
          model: candidate,
        });

        const isFallback = candidate !== primaryCandidate;
        if (isFallback) {
          console.error(
            `[mcp-nvidia-nim] Automatic fallback triggered: '${primaryCandidate}' -> '${candidate}' (reason: ${attempts[0]?.error})`
          );
        }

        return {
          response,
          modelUsed: candidate,
          requestedModel: primaryCandidate,
          fallbackTriggered: isFallback,
          fallbackReason: isFallback ? attempts[0]?.error : undefined,
          attempts,
        };
      } catch (err: unknown) {
        lastError = err as Error;
        const errMsg = (err as Error).message;
        attempts.push({ model: candidate, error: errMsg });

        // If auth error 401, fail immediately
        if (err instanceof NimClientError && err.statusCode === 401) {
          throw err;
        }

        // If candidates remain, continue fallback chain
        if (i < candidateChain.length - 1) {
          console.error(
            `[mcp-nvidia-nim] Model '${candidate}' failed. Trying next candidate '${candidateChain[i + 1]}' in fallback chain.`
          );
          continue;
        }
      }
    }

    throw lastError || new NimClientError("All models in the fallback chain failed.");
  }

  public async quickPrompt(
    prompt: string,
    options?: {
      model?: string;
      systemPrompt?: string;
      temperature?: number;
      maxTokens?: number;
      enableFallback?: boolean;
    }
  ): Promise<string> {
    const messages: ChatMessage[] = [];
    if (options?.systemPrompt) {
      messages.push({ role: "system", content: options.systemPrompt });
    }
    messages.push({ role: "user", content: prompt });

    const enableFallback = options?.enableFallback ?? true;

    if (enableFallback) {
      const fallbackResult = await this.chatCompletionWithFallback({
        model: options?.model,
        messages,
        temperature: options?.temperature,
        max_tokens: options?.maxTokens,
      });

      const choice = fallbackResult.response.choices?.[0];
      if (!choice || !choice.message?.content) {
        throw new NimClientError("NVIDIA NIM returned an empty response.");
      }

      let content = choice.message.content;
      if (fallbackResult.fallbackTriggered) {
        content = `> ⚠️ **[Fallback Triggered]** Requested model \`${fallbackResult.requestedModel}\` was unavailable. Automatically routed to \`${fallbackResult.modelUsed}\`.\n\n${content}`;
      }
      return content;
    }

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

  /**
   * Probes a specific model with a lightweight test ping to verify health and entitlement.
   */
  public async probeModel(model: string, timeoutMs = 8000): Promise<ModelHealthProbeResult> {
    const resolved = resolveModel(model);
    const startTime = Date.now();

    try {
      const bodyContent = resolved.includes("vision")
        ? [{ type: "text", text: "ping" }]
        : "ping";

      await this.rateLimiter.acquire();

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          model: resolved,
          messages: [{ role: "user", content: bodyContent }],
          max_tokens: 1,
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });

      const latencyMs = Date.now() - startTime;

      if (response.ok) {
        return {
          model: resolved,
          status: latencyMs > 3000 ? "degraded" : "healthy",
          statusCode: response.status,
          latencyMs,
        };
      }

      const errText = await response.text();
      return {
        model: resolved,
        status: "unavailable",
        statusCode: response.status,
        latencyMs,
        error: `[${response.status}] ${errText.slice(0, 120)}`,
      };
    } catch (err: unknown) {
      const latencyMs = Date.now() - startTime;
      return {
        model: resolved,
        status: "unavailable",
        latencyMs,
        error: (err as Error).message,
      };
    }
  }

  /**
   * Runs diagnostic health probes with Quota Reservation Protection and TTL caching.
   */
  public async probeCatalog(
    optionsOrModels?:
      | {
          models?: string[];
          force?: boolean;
          timeoutMs?: number;
        }
      | string[]
  ): Promise<CatalogHealthReport> {
    const options = Array.isArray(optionsOrModels)
      ? { models: optionsOrModels }
      : optionsOrModels;
    const force = options?.force ?? false;
    const now = Date.now();

    // 1. If health check probes are disabled via environment variable
    if (!this.healthCheckEnabled) {
      return {
        timestamp: new Date().toISOString(),
        fromCache: false,
        totalTested: 0,
        healthyCount: 0,
        degradedCount: 0,
        unavailableCount: 0,
        throttledDueToQuota: true,
        quotaMessage: "Synthetic healthcheck probes are disabled via NVIDIA_HEALTHCHECK_ENABLED=false to strictly conserve RPM.",
        results: [],
      };
    }

    // 2. Return cached report if still fresh and not forced
    if (
      !force &&
      this.cachedHealthReport &&
      now - new Date(this.cachedHealthReport.timestamp).getTime() < this.healthCheckCacheTtlMs
    ) {
      return {
        ...this.cachedHealthReport,
        fromCache: true,
      };
    }

    // 3. Quota Safety Floor (Circuit Breaker)
    // If available slots in the current 60s window are below minRpmReserve, abort synthetic probes to prevent starving real work
    const rateStatus = this.rateLimiter.getStatus();
    if (!force && rateStatus.availableSlots < this.minRpmReserve) {
      if (this.cachedHealthReport) {
        return {
          ...this.cachedHealthReport,
          fromCache: true,
          throttledDueToQuota: true,
          quotaMessage: `Synthetic probes throttled to protect workload: only ${rateStatus.availableSlots} slots available (reserve floor: ${this.minRpmReserve}). Returning latest cached health status.`,
        };
      }

      return {
        timestamp: new Date().toISOString(),
        fromCache: false,
        totalTested: 0,
        healthyCount: 0,
        degradedCount: 0,
        unavailableCount: 0,
        throttledDueToQuota: true,
        quotaMessage: `Synthetic probes throttled to protect workload: only ${rateStatus.availableSlots} slots available (reserve floor: ${this.minRpmReserve}). Real requests have full priority.`,
        results: [],
      };
    }

    // 4. Default to key essential models rather than the entire 15+ catalog to keep quota consumption minimal
    const defaultEssentialModels = [
      "mistralai/mistral-large-4-1t-a52b",
      "nvidia/nemotron-3-ultra-550b-a55b",
      "poolside/laguna-xs-2.1",
      "meta/llama-3.2-90b-vision-instruct",
    ];

    const targetModels =
      options?.models && options.models.length > 0
        ? options.models.map((m) => resolveModel(m))
        : defaultEssentialModels;

    const results: ModelHealthProbeResult[] = [];
    const timeoutMs = options?.timeoutMs ?? 6000;

    for (const m of targetModels) {
      // Re-check safety floor before each probe in case concurrent requests arrived
      if (!force && this.rateLimiter.getStatus().availableSlots < this.minRpmReserve) {
        break;
      }
      const result = await this.probeModel(m, timeoutMs);
      results.push(result);
    }

    const healthyCount = results.filter((r) => r.status === "healthy").length;
    const degradedCount = results.filter((r) => r.status === "degraded").length;
    const unavailableCount = results.filter((r) => r.status === "unavailable").length;

    const report: CatalogHealthReport = {
      timestamp: new Date().toISOString(),
      fromCache: false,
      totalTested: results.length,
      healthyCount,
      degradedCount,
      unavailableCount,
      results,
    };

    this.cachedHealthReport = report;
    return report;
  }
}
