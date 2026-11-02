import test from "node:test";
import assert from "node:assert/strict";
import { NimClient } from "../src/client.js";

test("probeCatalog: should cache results within TTL and avoid redundant network calls", async () => {
  const client = new NimClient({
    apiKey: "nvapi-test-key",
    baseUrl: "https://integrate.api.nvidia.com/v1",
    rateLimitRpm: 40,
    defaultModel: "mistral",
    healthCheckCacheTtlMs: 60_000,
  });

  const originalFetch = globalThis.fetch;
  let fetchCallCount = 0;

  globalThis.fetch = (async () => {
    fetchCallCount++;
    return new Response(JSON.stringify({ choices: [{ message: { content: "probe-ok" } }] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;

  try {
    // 1st run: fresh probe
    const report1 = await client.probeCatalog({ models: ["mistral"] });
    assert.equal(report1.fromCache, false);
    assert.equal(report1.healthyCount, 1);
    assert.equal(fetchCallCount, 1);

    // 2nd run: should hit TTL cache
    const report2 = await client.probeCatalog({ models: ["mistral"] });
    assert.equal(report2.fromCache, true);
    assert.equal(report2.healthyCount, 1);
    assert.equal(fetchCallCount, 1); // no extra fetch call

    // 3rd run with force: true -> bypass cache
    const report3 = await client.probeCatalog({ models: ["mistral"], force: true });
    assert.equal(report3.fromCache, false);
    assert.equal(fetchCallCount, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("probeCatalog: should enforce quota safety floor and protect RPM quota", async () => {
  const client = new NimClient({
    apiKey: "nvapi-test-key",
    baseUrl: "https://integrate.api.nvidia.com/v1",
    rateLimitRpm: 40,
    defaultModel: "mistral",
    minRpmReserve: 15,
  });

  const originalFetch = globalThis.fetch;
  let fetchCallCount = 0;

  globalThis.fetch = (async () => {
    fetchCallCount++;
    return new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;

  try {
    // Consume 26 slots so availableSlots becomes 14 (less than minRpmReserve: 15)
    for (let i = 0; i < 26; i++) {
      await client.chatCompletion({
        model: "mistral",
        messages: [{ role: "user", content: "ping" }],
      });
    }

    assert.equal(fetchCallCount, 26);
    const rateStatus = client.getRateLimiterStatus();
    assert.equal(rateStatus.availableSlots, 14);
    assert.ok(rateStatus.availableSlots < 15);

    // Now try to run probeCatalog without force
    const throttledReport = await client.probeCatalog({ models: ["mistral"] });
    assert.equal(throttledReport.throttledDueToQuota, true);
    assert.ok(throttledReport.quotaMessage?.includes("reserve floor: 15"));
    // Probes were NOT executed over network
    assert.equal(fetchCallCount, 26);

    // Force probe should bypass quota safety floor
    const forcedReport = await client.probeCatalog({ models: ["mistral"], force: true });
    assert.equal(forcedReport.throttledDueToQuota, undefined);
    assert.equal(fetchCallCount, 27);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("probeCatalog: should disable synthetic probes when healthCheckEnabled is false", async () => {
  const client = new NimClient({
    apiKey: "nvapi-test-key",
    baseUrl: "https://integrate.api.nvidia.com/v1",
    rateLimitRpm: 40,
    defaultModel: "mistral",
    healthCheckEnabled: false,
  });

  const originalFetch = globalThis.fetch;
  let fetchCallCount = 0;

  globalThis.fetch = (async () => {
    fetchCallCount++;
    return new Response("ok", { status: 200 });
  }) as typeof fetch;

  try {
    const report = await client.probeCatalog();
    assert.equal(report.throttledDueToQuota, true);
    assert.equal(report.totalTested, 0);
    assert.ok(report.quotaMessage?.includes("NVIDIA_HEALTHCHECK_ENABLED=false"));
    assert.equal(fetchCallCount, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("probeCatalog: supports both options object and string array for backward compatibility", async () => {
  const client = new NimClient({
    apiKey: "nvapi-test-key",
    baseUrl: "https://integrate.api.nvidia.com/v1",
    rateLimitRpm: 40,
    defaultModel: "mistral",
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    return new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;

  try {
    // Array style
    const reportFromArray = await client.probeCatalog(["mistral"]);
    assert.equal(reportFromArray.healthyCount, 1);

    // Object style
    const reportFromObject = await client.probeCatalog({ models: ["mistral"], force: true });
    assert.equal(reportFromObject.healthyCount, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("updatePassiveHealth: regular chat completions passively update cached health report", async () => {
  const client = new NimClient({
    apiKey: "nvapi-test-key",
    baseUrl: "https://integrate.api.nvidia.com/v1",
    rateLimitRpm: 40,
    defaultModel: "mistral",
    healthCheckCacheTtlMs: 600_000,
  });

  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () => {
    return new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;

  try {
    // Initialize cache with 1 model
    await client.probeCatalog({ models: ["mistral"] });

    // Now run chatCompletion for another model
    await client.chatCompletion({
      model: "poolside/laguna-xs-2.1",
      messages: [{ role: "user", content: "test" }],
    });

    // Check cached report (should return from cache without re-probing)
    const cached = await client.probeCatalog();
    assert.equal(cached.fromCache, true);
    const poolsideEntry = cached.results.find((r) => r.model === "poolside/laguna-xs-2.1");
    assert.ok(poolsideEntry, "poolside/laguna-xs-2.1 should be passively recorded in cached health report");
    assert.equal(poolsideEntry?.status, "healthy");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
