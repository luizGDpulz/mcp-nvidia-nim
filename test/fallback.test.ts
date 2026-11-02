import test from "node:test";
import assert from "node:assert/strict";
import { getModelFallbackChain, MODEL_FALLBACK_CHAINS } from "../src/models.js";
import { NimClient, NimClientError } from "../src/client.js";

test("getModelFallbackChain: should return primary model and its configured fallbacks without duplicates", () => {
  const codeChain = getModelFallbackChain("code");
  assert.equal(codeChain[0], "poolside/laguna-xs-2.1");
  assert.ok(codeChain.includes("mistralai/mistral-large-4-1t-a52b"));

  const ultraChain = getModelFallbackChain("ultra");
  assert.equal(ultraChain[0], "nvidia/nemotron-3-ultra-550b-a55b");
  assert.ok(ultraChain.includes("nvidia/nemotron-3-nano-omni-30b-a3b-reasoning"));

  const visionChain = getModelFallbackChain("vision");
  assert.equal(visionChain[0], "meta/llama-3.2-90b-vision-instruct");
  assert.ok(visionChain.includes("nvidia/nemotron-3.5-super-vl-120b-a12b"));
});

test("getModelFallbackChain: should handle unknown custom models gracefully with single entry", () => {
  const custom = "custom/unknown-model";
  const chain = getModelFallbackChain(custom);
  assert.deepEqual(chain, [custom]);
});

test("NimClient: should failover to fallback model when primary model returns 404", async () => {
  const client = new NimClient({
    apiKey: "nvapi-test-key",
    baseUrl: "https://integrate.api.nvidia.com/v1",
    rateLimitRpm: 40,
    defaultModel: "mistral",
  });

  const originalFetch = globalThis.fetch;
  const calls: string[] = [];

  // Mock global fetch to fail on poolside/laguna-xs-2.1 with 404, but succeed on mistralai/mistral-large-4-1t-a52b
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse((init?.body as string) || "{}");
    const requestedModel = body.model;
    calls.push(requestedModel);

    if (requestedModel === "poolside/laguna-xs-2.1") {
      return new Response(JSON.stringify({ status: 404, detail: "Model not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        id: "chat-test",
        object: "chat.completion",
        created: Date.now(),
        model: requestedModel,
        choices: [
          {
            index: 0,
            message: { role: "assistant", content: "Fallback response content" },
            finish_reason: "stop",
          },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }) as typeof fetch;

  try {
    const result = await client.chatCompletionWithFallback({
      model: "code",
      messages: [{ role: "user", content: "Audit this code" }],
    });

    assert.equal(result.fallbackTriggered, true);
    assert.equal(result.requestedModel, "poolside/laguna-xs-2.1");
    assert.equal(result.modelUsed, "mistralai/mistral-large-4-1t-a52b");
    assert.equal(result.response.choices[0].message.content, "Fallback response content");
    assert.deepEqual(calls, ["poolside/laguna-xs-2.1", "mistralai/mistral-large-4-1t-a52b"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("NimClient: probeModel should report healthy on 200 and unavailable on 404", async () => {
  const client = new NimClient({
    apiKey: "nvapi-test-key",
    baseUrl: "https://integrate.api.nvidia.com/v1",
    rateLimitRpm: 40,
    defaultModel: "mistral",
  });

  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse((init?.body as string) || "{}");
    if (body.model.includes("invalid")) {
      return new Response("Not found", { status: 404 });
    }
    return new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), {
      status: 200,
    });
  }) as typeof fetch;

  try {
    const healthyProbe = await client.probeModel("mistral");
    assert.equal(healthyProbe.status, "healthy");
    assert.equal(healthyProbe.statusCode, 200);

    const unavailableProbe = await client.probeModel("invalid-model");
    assert.equal(unavailableProbe.status, "unavailable");
    assert.equal(unavailableProbe.statusCode, 404);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
