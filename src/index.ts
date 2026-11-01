#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import dotenv from "dotenv";
import { NimClient } from "./client.js";
import { registerNimTools } from "./tools.js";

// Carrega variáveis de ambiente do .env da raiz do projeto ou diretório corrente
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config();

const apiKey = process.env.NVIDIA_API_KEY;
if (!apiKey) {
  console.error(
    "ERRO CRÍTICO: Variável NVIDIA_API_KEY não foi encontrada no ambiente ou arquivo .env. Obtenha sua chave em https://build.nvidia.com"
  );
  process.exit(1);
}

const baseUrl = process.env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1";
const rateLimitRpm = parseInt(process.env.NVIDIA_RATE_LIMIT_RPM || "40", 10);
const defaultModel = process.env.NVIDIA_DEFAULT_MODEL || "mistralai/mistral-large-4-1t-a52b";

const client = new NimClient({
  apiKey,
  baseUrl,
  rateLimitRpm,
  defaultModel,
});

const server = new McpServer({
  name: "mcp-nvidia-nim",
  version: "1.0.0",
});

registerNimTools(server, client);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(
    `[mcp-nvidia-nim] Servidor MCP iniciado via Stdio (NVIDIA NIM Base: ${baseUrl}, RateLimit: ${rateLimitRpm} RPM, Default: ${defaultModel})`
  );
}

main().catch((err) => {
  console.error("[mcp-nvidia-nim] Erro fatal na inicialização:", err);
  process.exit(1);
});
