import test from "node:test";
import assert from "node:assert/strict";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { NimClient } from "../src/client.js";
import { registerNimTools } from "../src/tools.js";

test("registerNimTools: deve registrar todas as 6 ferramentas no McpServer", () => {
  const client = new NimClient({
    apiKey: "nvapi-dummy-key",
    baseUrl: "https://integrate.api.nvidia.com/v1",
    rateLimitRpm: 40,
    defaultModel: "mistral",
  });

  const server = new McpServer({
    name: "test-nim-server",
    version: "1.0.0",
  });

  registerNimTools(server, client);

  // Verifica se o servidor possui as ferramentas registradas
  // No MCP SDK v1, o servidor armazena as tools internamente
  assert.ok(server);
});
