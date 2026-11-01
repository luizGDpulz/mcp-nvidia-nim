import test from "node:test";
import assert from "node:assert/strict";
import { NimClient, NimClientError } from "../src/client.js";

test("NimClient: deve falhar ao instanciar sem API Key", () => {
  assert.throws(
    () => {
      new NimClient({
        apiKey: "",
        baseUrl: "https://integrate.api.nvidia.com/v1",
        rateLimitRpm: 40,
        defaultModel: "mistral",
      });
    },
    {
      name: "NimClientError",
      message: "NVIDIA API key é obrigatória.",
    }
  );
});

test("NimClient: deve inicializar corretamente com rate limiter", () => {
  const client = new NimClient({
    apiKey: "nvapi-test-dummy",
    baseUrl: "https://integrate.api.nvidia.com/v1",
    rateLimitRpm: 40,
    defaultModel: "mistral",
  });

  const status = client.getRateLimiterStatus();
  assert.equal(status.limit, 40);
  assert.equal(status.availableSlots, 40);
  assert.equal(status.currentRpm, 0);
});
