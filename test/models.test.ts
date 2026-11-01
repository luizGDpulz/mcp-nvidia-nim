import test from "node:test";
import assert from "node:assert/strict";
import { resolveModel, KNOWN_MODELS, MODEL_ALIASES } from "../src/models.js";

test("resolveModel: deve resolver aliases conhecidos corretamente", () => {
  assert.equal(resolveModel("reasoning"), "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning");
  assert.equal(resolveModel("ultra"), "nvidia/nemotron-3-ultra-550b-a55b");
  assert.equal(resolveModel("code"), "poolside/laguna-xs-2.1");
  assert.equal(resolveModel("vision"), "meta/llama-3.2-90b-vision-instruct");
  assert.equal(resolveModel("mistral"), "mistralai/mistral-large-4-1t-a52b");
  assert.equal(resolveModel("fast"), "nvidia/nemotron-3.5-lightning-30b-a3b");
  assert.equal(resolveModel("parse"), "nvidia/nemotron-parse-2.0");
  assert.equal(resolveModel("translate"), "nvidia/riva-translate-4b-instruct-v2");
});

test("resolveModel: deve retornar modelo padrão para strings vazias ou indefinidas", () => {
  assert.equal(resolveModel(), MODEL_ALIASES.default);
  assert.equal(resolveModel(""), MODEL_ALIASES.default);
  assert.equal(resolveModel("  "), MODEL_ALIASES.default);
});

test("resolveModel: deve repassar modelos personalizados desconhecidos sem alteração", () => {
  const custom = "custom-org/custom-model-70b";
  assert.equal(resolveModel(custom), custom);
});

test("KNOWN_MODELS: os modelos mapeados devem possuir metadados válidos", () => {
  for (const [id, meta] of Object.entries(KNOWN_MODELS)) {
    assert.equal(meta.id, id);
    assert.ok(meta.name.length > 0);
    assert.ok(meta.description.length > 0);
    assert.ok(["reasoning", "general", "code", "vision", "parsing", "translation", "safety", "experimental"].includes(meta.category));
  }
});
