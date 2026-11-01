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
  private mutexChain: Promise<void> = Promise.resolve();

  constructor(options?: RateLimiterOptions) {
    this.maxRequests = options?.maxRequests ?? 40;
    this.windowMs = options?.windowMs ?? 60_000;
  }

  /**
   * Internal timestamp cleaner (only called during state-modifying operations).
   */
  private cleanOldTimestamps(now: number): void {
    const cutoff = now - this.windowMs;
    const firstValidIndex = this.timestamps.findIndex((t) => t > cutoff);
    if (firstValidIndex > 0) {
      this.timestamps = this.timestamps.slice(firstValidIndex);
    } else if (firstValidIndex === -1 && this.timestamps.length > 0) {
      this.timestamps = [];
    }
  }

  /**
   * Pure read-only status query. Does not mutate internal state.
   */
  public getStatus(): RateLimiterStatus {
    const now = Date.now();
    const cutoff = now - this.windowMs;

    const validTimestamps = this.timestamps.filter((t) => t > cutoff);
    const oldest = validTimestamps[0];
    const nextResetMs = oldest ? Math.max(0, oldest + this.windowMs - now) : 0;

    return {
      currentRpm: validTimestamps.length,
      limit: this.maxRequests,
      availableSlots: Math.max(0, this.maxRequests - validTimestamps.length),
      nextResetMs,
    };
  }

  /**
   * Acquires a request slot in strict FIFO order, preventing race conditions under high concurrency.
   */
  public async acquire(): Promise<void> {
    const ticket = this.mutexChain.then(() => this.processAcquire());
    this.mutexChain = ticket.catch(() => {});
    return ticket;
  }

  private async processAcquire(): Promise<void> {
    while (true) {
      const now = Date.now();
      this.cleanOldTimestamps(now);

      if (this.timestamps.length < this.maxRequests) {
        this.timestamps.push(now);
        return;
      }

      // Calculate how long until the oldest timestamp exits the sliding window
      const oldest = this.timestamps[0];
      const waitTime = Math.max(20, oldest + this.windowMs - now + 20);

      await new Promise<void>((resolve) => setTimeout(resolve, waitTime));
    }
  }

  /**
   * Resets all timestamp records.
   */
  public reset(): void {
    this.timestamps = [];
    this.mutexChain = Promise.resolve();
  }
}
