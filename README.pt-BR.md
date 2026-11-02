# mcp-nvidia-nim

> Servidor **MCP (Model Context Protocol)** em TypeScript para orquestração de Modelos de Linguagem (LLMs), Raciocínio Profundo, Visão Computacional e Engenharia de Código via **NVIDIA NIM Cloud API**.

<p align="center">
  <a href="README.md">English</a> | <strong>Português</strong>
</p>

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)
[![pnpm](https://img.shields.io/badge/pnpm-12.9-orange.svg)](https://pnpm.io/)
[![MCP](https://img.shields.io/badge/Protocol-MCP-green.svg)](https://modelcontextprotocol.io/)
[![CI](https://github.com/luizGDpulz/mcp-nvidia-nim/actions/workflows/ci.yml/badge.svg)](https://github.com/luizGDpulz/mcp-nvidia-nim/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## 🎯 Visão Geral

O **`mcp-nvidia-nim`** integra assistentes de IA (Google Antigravity, Claude Desktop, Cursor, Roo-Code, etc.) ao catálogo oficial da **NVIDIA NIM**, permitindo consultar modelos de ponta com controle de taxa integrado de **40 RPM (Rate Limit da conta gratuita)**, resolução inteligente de aliases, **cadeias automáticas de fallback** para failover sem downtime, verificação ativa de saúde do catálogo e suporte nativo a imagens locais/remotas.

### 🌟 Destaques de Modelos Homologados
- 🧠 **Raciocínio & Arquitetura Ultra:** `nvidia/nemotron-3-ultra-550b-a55b` (550 bilhões de parâmetros) e `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning`.
- 💻 **Engenharia de Código:** `poolside/laguna-xs-2.1` (modelo da Poolside especialista em código) e `mistralai/mistral-large-4-1t-a52b`.
- 👁️ **Visão Multimodal de Grande Porte:** `meta/llama-3.2-90b-vision-instruct` e `nvidia/nemotron-3.5-super-vl-120b-a12b`.
- ⚡ **Alta Velocidade & Baixa Latência:** `nvidia/nemotron-3.5-lightning-30b-a3b` e `minimaxai/minimax-m3.1-flash`.
- 📄 **Extração e Parsing de Documentos:** `nvidia/nemotron-parse-2.0` (OCR e estruturação de tabelas/PDFs).
- 🌐 **Tradução Especializada:** `nvidia/riva-translate-4b-instruct-v2`.

---

## 🛠️ Ferramentas MCP Disponíveis

| Ferramenta | Descrição | Modelo Padrão / Fallback |
| :--- | :--- | :--- |
| `nim_query_model` | Consulta direta a qualquer modelo da NVIDIA NIM | `mistral` $\rightarrow$ `reasoning` |
| `nim_deep_reason` | Parecer arquitetural, lógica matemática e tradeoffs | `nemotron-ultra` (550B) $\rightarrow$ `reasoning` $\rightarrow$ `mistral` |
| `nim_review_code` | Auditoria de código, segurança, bugs e performance | `code` (`poolside/laguna-xs-2.1`) $\rightarrow$ `mistral` |
| `nim_analyze_vision` | Inspeção de diagramas, prints e wireframes locais ou remotos | `vision` (`meta/llama-3.2-90b-vision-instruct`) $\rightarrow$ `super-vl` |
| `nim_extract_document` | Estruturação de dados brutos e OCR em markdown/json/table | `parse` (`nvidia/nemotron-parse-2.0`) $\rightarrow$ `mistral` |
| `nim_health_check` | Diagnóstico ativo de saúde e latência dos endpoints da NVIDIA | — |
| `nim_status` | Status da cota de 40 RPM, métricas em tempo real e catálogo | — |

---

## 🛡️ Cadeias Automáticas de Fallback (Arquitetura de Resiliência)

Endpoints na nuvem da NVIDIA podem sofrer manutenções ou descontinuações inesperadas. Para que suas tarefas nunca falhem por indisponibilidade de modelo, o **`mcp-nvidia-nim` implementa failover automático**:

```text
Solicitado: [code] (poolside/laguna-xs-2.1)
            └── (HTTP 404 / 403 / Timeout) ──> Failover Automático ──> [mistralai/mistral-large-4-1t-a52b]
```

### Matriz de Redundância:
- **Engenharia de Código (`code`):** `poolside/laguna-xs-2.1` $\rightarrow$ `mistralai/mistral-large-4-1t-a52b` $\rightarrow$ `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning`
- **Raciocínio Pesado (`ultra`):** `nvidia/nemotron-3-ultra-550b-a55b` $\rightarrow$ `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning` $\rightarrow$ `mistralai/mistral-large-4-1t-a52b`
- **Visão Multimodal (`vision`):** `meta/llama-3.2-90b-vision-instruct` $\rightarrow$ `nvidia/nemotron-3.5-super-vl-120b-a12b`
- **Velocidade & Agilidade (`fast`):** `nvidia/nemotron-3.5-lightning-30b-a3b` $\rightarrow$ `minimaxai/minimax-m3.1-flash`
- **Extração de Documentos (`parse`):** `nvidia/nemotron-parse-2.0` $\rightarrow$ `mistralai/mistral-large-4-1t-a52b`

Quando um fallback é acionado, a resposta traz automaticamente uma nota informando o redirecionamento.

---

## 🏥 Diagnóstico Proativo (`nim_health_check`)

Você pode rodar varreduras de saúde dos modelos a qualquer momento via MCP:
- Executa probes leves de 1 token respeitando a fila de rate limit.
- Avalia status HTTP, autenticação e latência de ida e volta.
- Classifica cada modelo em:
  - 🟢 **Healthy** (latência $< 3000\text{ms}$, HTTP 200)
  - 🟡 **Degraded** (latência $\ge 3000\text{ms}$, HTTP 200)
  - 🔴 **Unavailable** (HTTP 404, 403, 500 ou timeout)

---

## 🚀 Instalação e Execução

### 1. Pré-requisitos
- **Node.js** `>= 20.x` (testado no Node 20, 22 e 24)
- **pnpm** `>= 10.x`
- Chave de API da NVIDIA NIM (`nvapi-...` obtida em [build.nvidia.com](https://build.nvidia.com))

### 2. Configuração do Projeto

```bash
git clone https://github.com/luizGDpulz/mcp-nvidia-nim.git
cd mcp-nvidia-nim

# Instalar dependências
pnpm install

# Configurar variáveis de ambiente
cp .env.example .env
chmod 600 .env
# Edite o .env e insira sua NVIDIA_API_KEY
```

### 3. Compilação e Testes

```bash
# Compilar TypeScript
pnpm build

# Executar suíte de testes unitários
pnpm test
```

---

## ⚙️ Variáveis de Ambiente (`.env`)

```env
# Chave da API NVIDIA NIM
NVIDIA_API_KEY=nvapi-your-key-here

# Base URL (padrão oficial)
NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1

# Limite de taxa (40 RPM padrão para conta free)
NVIDIA_RATE_LIMIT_RPM=40

# Modelo padrão para consultas simples
NVIDIA_DEFAULT_MODEL=mistralai/mistral-large-4-1t-a52b
```

---

## 🔌 Integração Global (Ex: Antigravity / Claude Desktop)

Adicione ao seu arquivo de configuração MCP (`~/.gemini/config/mcp_config.json` ou `claude_desktop_config.json`):

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

## 🏷️ Aliases Práticos

Ao usar a ferramenta `nim_query_model`, você pode passar diretamente o alias no parâmetro `model`:

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

## 🛡️ Rate Limiting Anti-Concorrência (Fila FIFO 40 RPM)

O servidor implementa um limitador de janela deslizante serializado:
- Utiliza uma fila assíncrona FIFO (`mutexChain`), garantindo reserva estrita de slots mesmo sob rajadas paralelas de requisições.
- Caso o limite de 40 requisições seja atingido, a próxima chamada aguarda automaticamente a liberação do slot mais antigo com backoff suave.
- Trata respostas `429 Too Many Requests` com retentativas exponenciais automáticas.

---

## 📄 Licença

Distribuído sob a licença [MIT](LICENSE).
