export interface RateLimiterOptions {
  maxRequests?: number;
  windowMs?: number;
}

export interface RateLimiterStatus {
  currentRpm: number;
  limit: number;
  availableSlots: number;
  nextResetMs: number;
}

export class SlidingWindowRateLimiter {
  private readonly maxRequests: number;
  private readonly windowMs: number;
  private timestamps: number[] = [];
  private waitQueue: Array<() => void> = [];

  constructor(options?: RateLimiterOptions) {
    this.maxRequests = options?.maxRequests ?? 40;
    this.windowMs = options?.windowMs ?? 60_000;
  }

  private cleanOldTimestamps(now: number): void {
    const cutoff = now - this.windowMs;
    while (this.timestamps.length > 0 && this.timestamps[0] <= cutoff) {
      this.timestamps.shift();
    }
  }

  public getStatus(): RateLimiterStatus {
    const now = Date.now();
    this.cleanOldTimestamps(now);

    const nextResetMs =
      this.timestamps.length > 0
        ? Math.max(0, this.timestamps[0] + this.windowMs - now)
        : 0;

    return {
      currentRpm: this.timestamps.length,
      limit: this.maxRequests,
      availableSlots: Math.max(0, this.maxRequests - this.timestamps.length),
      nextResetMs,
    };
  }

  public async acquire(): Promise<void> {
    while (true) {
      const now = Date.now();
      this.cleanOldTimestamps(now);

      if (this.timestamps.length < this.maxRequests) {
        this.timestamps.push(now);
        return;
      }

      // Janela cheia: calcula quanto tempo falta para o slot mais antigo expirar
      const oldest = this.timestamps[0];
      const waitTime = Math.max(50, oldest + this.windowMs - now + 50);

      await new Promise<void>((resolve) => setTimeout(resolve, waitTime));
    }
  }

  public reset(): void {
    this.timestamps = [];
  }
}
