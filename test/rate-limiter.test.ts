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

test("SlidingWindowRateLimiter: reset() should clear all timestamp history", async () => {
  const limiter = new SlidingWindowRateLimiter({ maxRequests: 2, windowMs: 1000 });
  await limiter.acquire();
  assert.equal(limiter.getStatus().currentRpm, 1);

  limiter.reset();
  assert.equal(limiter.getStatus().currentRpm, 0);
  assert.equal(limiter.getStatus().availableSlots, 2);
});
