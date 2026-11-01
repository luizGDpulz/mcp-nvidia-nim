import test from "node:test";
import assert from "node:assert/strict";
import { SlidingWindowRateLimiter } from "../src/rate-limiter.js";

test("SlidingWindowRateLimiter: deve inicializar com status zerado e slots disponíveis", () => {
  const limiter = new SlidingWindowRateLimiter({ maxRequests: 5, windowMs: 1000 });
  const status = limiter.getStatus();

  assert.equal(status.limit, 5);
  assert.equal(status.currentRpm, 0);
  assert.equal(status.availableSlots, 5);
  assert.equal(status.nextResetMs, 0);
});

test("SlidingWindowRateLimiter: deve consumir slots sequencialmente sem bloquear se houver cota", async () => {
  const limiter = new SlidingWindowRateLimiter({ maxRequests: 3, windowMs: 1000 });

  await limiter.acquire();
  await limiter.acquire();

  const status = limiter.getStatus();
  assert.equal(status.currentRpm, 2);
  assert.equal(status.availableSlots, 1);
  assert.ok(status.nextResetMs > 0);
});

test("SlidingWindowRateLimiter: deve bloquear e aguardar a janela de tempo quando a cota esgotar", async () => {
  const limiter = new SlidingWindowRateLimiter({ maxRequests: 2, windowMs: 150 });

  const start = Date.now();
  await limiter.acquire();
  await limiter.acquire();

  // A terceira chamada deve esperar a primeira expirar (~150ms)
  await limiter.acquire();
  const elapsed = Date.now() - start;

  assert.ok(elapsed >= 140, `Esperava pelo menos 140ms, decorreu: ${elapsed}ms`);
});

test("SlidingWindowRateLimiter: reset() limpa todo o histórico de timestamps", async () => {
  const limiter = new SlidingWindowRateLimiter({ maxRequests: 2, windowMs: 1000 });
  await limiter.acquire();
  assert.equal(limiter.getStatus().currentRpm, 1);

  limiter.reset();
  assert.equal(limiter.getStatus().currentRpm, 0);
  assert.equal(limiter.getStatus().availableSlots, 2);
});
