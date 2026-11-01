import test from "node:test";
import assert from "node:assert/strict";
import { SlidingWindowRateLimiter } from "../src/rate-limiter.js";

test("SlidingWindowRateLimiter: should initialize with zero usage and full available slots", () => {
  const limiter = new SlidingWindowRateLimiter({ maxRequests: 5, windowMs: 1000 });
  const status = limiter.getStatus();

  assert.equal(status.limit, 5);
  assert.equal(status.currentRpm, 0);
  assert.equal(status.availableSlots, 5);
  assert.equal(status.nextResetMs, 0);
});

test("SlidingWindowRateLimiter: should consume slots sequentially without blocking if quota available", async () => {
  const limiter = new SlidingWindowRateLimiter({ maxRequests: 3, windowMs: 1000 });

  await limiter.acquire();
  await limiter.acquire();

  const status = limiter.getStatus();
  assert.equal(status.currentRpm, 2);
  assert.equal(status.availableSlots, 1);
  assert.ok(status.nextResetMs > 0);
});

test("SlidingWindowRateLimiter: getStatus() must be pure and not mutate internal state", async () => {
  const limiter = new SlidingWindowRateLimiter({ maxRequests: 5, windowMs: 100 });
  await limiter.acquire();

  // Wait for timestamp to technically expire
  await new Promise((r) => setTimeout(r, 120));

  // getStatus should report 0 RPM without mutating the internal array
  const status1 = limiter.getStatus();
  assert.equal(status1.currentRpm, 0);
  assert.equal(status1.availableSlots, 5);

  const status2 = limiter.getStatus();
  assert.equal(status2.currentRpm, 0);
});

test("SlidingWindowRateLimiter: should block and wait for time window when quota exhausted", async () => {
  const limiter = new SlidingWindowRateLimiter({ maxRequests: 2, windowMs: 150 });

  const start = Date.now();
  await limiter.acquire();
  await limiter.acquire();

  // Third call must wait until the first timestamp expires (~150ms)
  await limiter.acquire();
  const elapsed = Date.now() - start;

  assert.ok(elapsed >= 140, `Expected at least 140ms elapsed, got: ${elapsed}ms`);
});

test("SlidingWindowRateLimiter: should handle concurrent acquire calls without race conditions", async () => {
  const limit = 4;
  const limiter = new SlidingWindowRateLimiter({ maxRequests: limit, windowMs: 150 });

  // Launch 8 concurrent calls with Promise.all
  const start = Date.now();
  const results = await Promise.all(
    Array.from({ length: 8 }, async (_, idx) => {
      await limiter.acquire();
      return { idx, acquiredAt: Date.now() - start };
    })
  );

  assert.equal(results.length, 8);
  // The first 4 should acquire almost immediately (< 50ms)
  const firstBatch = results.slice(0, 4);
  for (const r of firstBatch) {
    assert.ok(r.acquiredAt < 50, `Expected immediate acquire, got ${r.acquiredAt}ms`);
  }

  // The remaining 4 must have waited for the window to reset (>= 140ms)
  const secondBatch = results.slice(4);
  for (const r of secondBatch) {
    assert.ok(r.acquiredAt >= 140, `Expected deferred acquire, got ${r.acquiredAt}ms`);
  }
});

test("SlidingWindowRateLimiter: reset() should clear all timestamp history", async () => {
  const limiter = new SlidingWindowRateLimiter({ maxRequests: 2, windowMs: 1000 });
  await limiter.acquire();
  assert.equal(limiter.getStatus().currentRpm, 1);

  limiter.reset();
  assert.equal(limiter.getStatus().currentRpm, 0);
  assert.equal(limiter.getStatus().availableSlots, 2);
});
