# mcp-nvidia-nim

> TypeScript **MCP (Model Context Protocol)** server for orchestrating Large Language Models (LLMs), Deep Reasoning, Multimodal Vision, and Code Engineering via the **NVIDIA NIM Cloud API**.

<p align="center">
  <strong>English</strong> | <a href="README.pt-BR.md">Português</a>
</p>

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)
[![pnpm](https://img.shields.io/badge/pnpm-12.9-orange.svg)](https://pnpm.io/)
[![MCP](https://img.shields.io/badge/Protocol-MCP-green.svg)](https://modelcontextprotocol.io/)
[![CI](https://github.com/luizGDpulz/mcp-nvidia-nim/actions/workflows/ci.yml/badge.svg)](https://github.com/luizGDpulz/mcp-nvidia-nim/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## 🎯 Overview

**`mcp-nvidia-nim`** connects AI assistants and agents (Google Antigravity, Claude Desktop, Cursor, Roo-Code, etc.) directly to the official **NVIDIA NIM** cloud catalog. It features built-in **40 RPM sliding-window rate limiting** (matching NVIDIA's free tier quota), intelligent model alias resolution, **automatic fallback chains** for zero-downtime model failover, proactive catalog health checks, and seamless support for local and remote image inputs.

### 🌟 Verified Model Highlights
- 🧠 **Ultra-Scale Reasoning & Architecture:** `nvidia/nemotron-3-ultra-550b-a55b` (550 billion parameters) and `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning`.
- 💻 **Software Engineering & Code Review:** `poolside/laguna-xs-2.1` (Poolside's code specialist model) and `mistralai/mistral-large-4-1t-a52b`.
- 👁️ **Large-Scale Multimodal Vision:** `meta/llama-3.2-90b-vision-instruct` and `nvidia/nemotron-3.5-super-vl-120b-a12b`.
- ⚡ **High Throughput & Low Latency:** `nvidia/nemotron-3.5-lightning-30b-a3b` and `minimaxai/minimax-m3.1-flash`.
- 📄 **Document & Data Extraction:** `nvidia/nemotron-parse-2.0` (OCR, table, and markdown parser).
- 🌐 **Technical Multilingual Translation:** `nvidia/riva-translate-4b-instruct-v2`.

---

## 🛠️ MCP Tools Reference

| Tool Name | Description | Default Model / Fallback |
| :--- | :--- | :--- |
| `nim_query_model` | Direct prompt query against any NVIDIA NIM model | `mistral` $\rightarrow$ `reasoning` |
| `nim_deep_reason` | In-depth architectural advisory, logic, and tradeoffs | `nemotron-ultra` (550B) $\rightarrow$ `reasoning` $\rightarrow$ `mistral` |
| `nim_review_code` | Technical code and git diff review (security, bugs, performance) | `code` (`poolside/laguna-xs-2.1`) $\rightarrow$ `mistral` |
| `nim_analyze_vision` | Multimodal visual inspection for diagrams, wireframes, and screenshots | `vision` (`meta/llama-3.2-90b-vision-instruct`) $\rightarrow$ `super-vl` |
| `nim_extract_document` | Semantic extraction and formatting into markdown, json, or table | `parse` (`nvidia/nemotron-parse-2.0`) $\rightarrow$ `mistral` |
| `nim_health_check` | Proactive ping probe across models to detect outages or deprecations | — |
| `nim_status` | Real-time rate limiter telemetry (40 RPM window), metrics, and catalog | — |

---

## 🛡️ Automatic Fallback Chains (Resilience Architecture)

NVIDIA cloud endpoints can occasionally change, undergo maintenance, or deprecate specific model function UUIDs. To ensure your AI agents never break in production, **`mcp-nvidia-nim` implements automatic failover**:

```text
Requested: [code] (poolside/laguna-xs-2.1)
           └── (HTTP 404 / 403 / Timeout) ──> Automatic Failover ──> [mistralai/mistral-large-4-1t-a52b]
```

### Fallback Matrix:
- **Code Engineering (`code`):** `poolside/laguna-xs-2.1` $\rightarrow$ `mistralai/mistral-large-4-1t-a52b` $\rightarrow$ `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning`
- **Ultra Reasoning (`ultra`):** `nvidia/nemotron-3-ultra-550b-a55b` $\rightarrow$ `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning` $\rightarrow$ `mistralai/mistral-large-4-1t-a52b`
- **Multimodal Vision (`vision`):** `meta/llama-3.2-90b-vision-instruct` $\rightarrow$ `nvidia/nemotron-3.5-super-vl-120b-a12b`
- **Speed & Agility (`fast`):** `nvidia/nemotron-3.5-lightning-30b-a3b` $\rightarrow$ `minimaxai/minimax-m3.1-flash`
- **Document Parsing (`parse`):** `nvidia/nemotron-parse-2.0` $\rightarrow$ `mistralai/mistral-large-4-1t-a52b`

When a fallback triggers, the response seamlessly includes an advisory notice informing the caller of the redirection.

---

## 🏥 Proactive Health Check (`nim_health_check`)

You can run diagnostic health probes at any time via the MCP tool `nim_health_check`:
- Fires lightweight 1-token probes respecting rate limits.
- Evaluates HTTP status code, entitlement, and roundtrip latency.
- Categorizes each model as:
  - 🟢 **Healthy** (latency $< 3000\text{ms}$, HTTP 200)
  - 🟡 **Degraded** (latency $\ge 3000\text{ms}$, HTTP 200)
  - 🔴 **Unavailable** (HTTP 404, 403, 500, or timeout)

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js** `>= 20.x` (tested on Node 20, 22, 24)
- **pnpm** `>= 10.x`
- NVIDIA NIM API Key (`nvapi-...` from [build.nvidia.com](https://build.nvidia.com))

### 2. Installation & Setup

```bash
git clone https://github.com/luizGDpulz/mcp-nvidia-nim.git
cd mcp-nvidia-nim

# Install dependencies
pnpm install

# Configure environment variables
cp .env.example .env
chmod 600 .env
# Edit .env and paste your NVIDIA_API_KEY
```

### 3. Build & Test

```bash
# Compile TypeScript to dist/
pnpm build

# Run unit test suite
pnpm test
```

---

## ⚙️ Environment Configuration (`.env`)

```env
# NVIDIA NIM API Key
NVIDIA_API_KEY=nvapi-your-key-here

# Base URL (official endpoint)
NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1

# Rate limit per minute (standard free tier is 40 RPM)
NVIDIA_RATE_LIMIT_RPM=40

# Default model for standard queries
NVIDIA_DEFAULT_MODEL=mistralai/mistral-large-4-1t-a52b
```

---

## 🔌 MCP Client Configuration (e.g. Antigravity / Claude Desktop)

Add the server to your MCP configuration file (`~/.gemini/config/mcp_config.json` or `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "nvidia-nim": {
      "command": "node",
      "args": [
        "/home/ubuntu/dev/mcp-nvidia-nim/dist/index.js"
      ]
    }
  }
}
```

---

## 🏷️ Model Aliases

When calling `nim_query_model`, you can pass handy shorthand aliases in the `model` parameter:

- `ultra` $\rightarrow$ `nvidia/nemotron-3-ultra-550b-a55b`
- `reasoning` $\rightarrow$ `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning`
- `fast` / `lightning` $\rightarrow$ `nvidia/nemotron-3.5-lightning-30b-a3b`
- `flash` $\rightarrow$ `minimaxai/minimax-m3.1-flash`
- `mistral` $\rightarrow$ `mistralai/mistral-large-4-1t-a52b`
- `code` / `laguna` $\rightarrow$ `poolside/laguna-xs-2.1`
- `vision` $\rightarrow$ `meta/llama-3.2-90b-vision-instruct`
- `super-vl` $\rightarrow$ `nvidia/nemotron-3.5-super-vl-120b-a12b`
- `parse` $\rightarrow$ `nvidia/nemotron-parse-2.0`
- `translate` $\rightarrow$ `nvidia/riva-translate-4b-instruct-v2`
- `guard` $\rightarrow$ `nvidia/llama-3.1-nemotron-safety-guard-8b-v3`

---

## 🛡️ Sliding Window Rate Limiting (FIFO 40 RPM)

The server enforces an in-memory sliding window rate limiter:
- Uses a chained asynchronous FIFO queue (`mutexChain`) ensuring strict sequential slot reservation without race conditions under parallel bursts.
- If the 40 requests/min threshold is reached, subsequent requests automatically sleep and wait for the earliest slot to expire before executing.
- Gracefully handles upstream `429 Too Many Requests` status codes with exponential backoff and retry.

---

## 📄 License

Distributed under the [MIT](LICENSE) License.
