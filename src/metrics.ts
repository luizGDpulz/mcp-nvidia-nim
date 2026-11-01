export interface ModelExecutionMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  totalTokensUsed: number;
  totalLatencyMs: number;
  avgLatencyMs: number;
  lastUsedAt: string | null;
  lastError: string | null;
}

export interface TelemetrySummary {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  totalTokensUsed: number;
  models: Record<string, ModelExecutionMetrics>;
}

export class MetricsCollector {
  private readonly modelMetrics: Map<string, ModelExecutionMetrics> = new Map();

  private getOrCreateModel(model: string): ModelExecutionMetrics {
    let metrics = this.modelMetrics.get(model);
    if (!metrics) {
      metrics = {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        totalTokensUsed: 0,
        totalLatencyMs: 0,
        avgLatencyMs: 0,
        lastUsedAt: null,
        lastError: null,
      };
      this.modelMetrics.set(model, metrics);
    }
    return metrics;
  }

  public recordSuccess(model: string, latencyMs: number, tokensUsed?: number): void {
    const metrics = this.getOrCreateModel(model);
    metrics.totalRequests++;
    metrics.successfulRequests++;
    metrics.totalLatencyMs += latencyMs;
    metrics.avgLatencyMs = Math.round(metrics.totalLatencyMs / metrics.totalRequests);
    metrics.lastUsedAt = new Date().toISOString();
    metrics.lastError = null;

    if (tokensUsed && tokensUsed > 0) {
      metrics.totalTokensUsed += tokensUsed;
    }
  }

  public recordFailure(model: string, latencyMs: number, error: unknown): void {
    const metrics = this.getOrCreateModel(model);
    metrics.totalRequests++;
    metrics.failedRequests++;
    metrics.totalLatencyMs += latencyMs;
    metrics.avgLatencyMs = Math.round(metrics.totalLatencyMs / metrics.totalRequests);
    metrics.lastUsedAt = new Date().toISOString();
    metrics.lastError = error instanceof Error ? error.message : String(error);
  }

  public getSummary(): TelemetrySummary {
    let totalRequests = 0;
    let successfulRequests = 0;
    let failedRequests = 0;
    let totalTokensUsed = 0;

    const models: Record<string, ModelExecutionMetrics> = {};

    for (const [model, m] of this.modelMetrics.entries()) {
      models[model] = { ...m };
      totalRequests += m.totalRequests;
      successfulRequests += m.successfulRequests;
      failedRequests += m.failedRequests;
      totalTokensUsed += m.totalTokensUsed;
    }

    return {
      totalRequests,
      successfulRequests,
      failedRequests,
      totalTokensUsed,
      models,
    };
  }

  public reset(): void {
    this.modelMetrics.clear();
  }
}
