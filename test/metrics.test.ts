import test from "node:test";
import assert from "node:assert/strict";
import { MetricsCollector } from "../src/metrics.js";

test("MetricsCollector: should initialize with zero counts", () => {
  const collector = new MetricsCollector();
  const summary = collector.getSummary();

  assert.equal(summary.totalRequests, 0);
  assert.equal(summary.successfulRequests, 0);
  assert.equal(summary.failedRequests, 0);
  assert.equal(summary.totalTokensUsed, 0);
  assert.deepEqual(summary.models, {});
});

test("MetricsCollector: should record successful requests and calculate average latency", () => {
  const collector = new MetricsCollector();
  collector.recordSuccess("mistral", 200, 50);
  collector.recordSuccess("mistral", 400, 50);

  const summary = collector.getSummary();
  assert.equal(summary.totalRequests, 2);
  assert.equal(summary.successfulRequests, 2);
  assert.equal(summary.failedRequests, 0);
  assert.equal(summary.totalTokensUsed, 100);

  const mistral = summary.models["mistral"];
  assert.ok(mistral);
  assert.equal(mistral.totalRequests, 2);
  assert.equal(mistral.avgLatencyMs, 300);
  assert.equal(mistral.lastError, null);
  assert.ok(mistral.lastUsedAt);
});

test("MetricsCollector: should record failures with error details", () => {
  const collector = new MetricsCollector();
  collector.recordFailure("ultra", 150, new Error("Quota exceeded"));

  const summary = collector.getSummary();
  assert.equal(summary.totalRequests, 1);
  assert.equal(summary.failedRequests, 1);

  const ultra = summary.models["ultra"];
  assert.ok(ultra);
  assert.equal(ultra.failedRequests, 1);
  assert.equal(ultra.lastError, "Quota exceeded");
});

test("MetricsCollector: reset() should clear all telemetry", () => {
  const collector = new MetricsCollector();
  collector.recordSuccess("code", 100);
  assert.equal(collector.getSummary().totalRequests, 1);

  collector.reset();
  assert.equal(collector.getSummary().totalRequests, 0);
});
