# mcp-nvidia-nim

> Servidor **MCP (Model Context Protocol)** em TypeScript para orquestração de Modelos de Linguagem (LLMs), Raciocínio Profundo, Visão Computacional e Engenharia de Código via **NVIDIA NIM Cloud API**.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)
[![pnpm](https://img.shields.io/badge/pnpm-12.9-orange.svg)](https://pnpm.io/)
[![MCP](https://img.shields.io/badge/Protocol-MCP-green.svg)](https://modelcontextprotocol.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## 🎯 Visão Geral

O **`mcp-nvidia-nim`** integra assistentes de IA (Google Antigravity, Claude Desktop, Cursor, Roo-Code, etc.) ao catálogo oficial da **NVIDIA NIM**, permitindo consultar modelos de ponta com controle de taxa integrado de **40 RPM (Rate Limit da conta gratuita)**, resolução inteligente de aliases e suporte nativo a imagens locais/remotas.

### 🌟 Destaques de Modelos Homologados
- 🧠 **Raciocínio & Arquitetura Ultra:** `nvidia/nemotron-3-ultra-550b-a55b` (550 bilhões de parâmetros) e `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning`.
- 💻 **Engenharia de Código:** `poolside/laguna-xs-2.1` (modelo da Poolside especialista em código) e `mistralai/mistral-large-4-1t-a52b`.
- 👁️ **Visão Multimodal de Grande Porte:** `meta/llama-3.2-90b-vision-instruct` e `nvidia/nemotron-3.5-super-vl-120b-a12b`.
- ⚡ **Alta Velocidade & Baixa Latência:** `nvidia/nemotron-3.5-lightning-30b-a3b` e `minimaxai/minimax-m3.1-flash`.
- 📄 **Extração e Parsing de Documentos:** `nvidia/nemotron-parse-2.0` (OCR e estruturação de tabelas/PDFs).
- 🌐 **Tradução Especializada:** `nvidia/riva-translate-4b-instruct-v2`.

---

## 🛠️ Ferramentas MCP Disponíveis

| Ferramenta | Descrição | Modelo Padrão / Alias |
| :--- | :--- | :--- |
| `nim_consultar_modelo` | Consulta direta a qualquer modelo da NVIDIA NIM | `mistral` / Customizável |
| `nim_raciocinar_profundo` | Parecer arquitetural, lógica matemática e tradeoffs | `nemotron-ultra` (550B) ou `reasoning` |
| `nim_revisar_codigo` | Auditoria de código, segurança, bugs e performance | `code` (`poolside/laguna-xs-2.1`) |
| `nim_analisar_visao` | Inspeção de diagramas, prints e wireframes | `vision` (`meta/llama-3.2-90b-vision-instruct`) |
| `nim_extrair_documento` | Estruturação de dados brutos e OCR em markdown/json | `parse` (`nvidia/nemotron-parse-2.0`) |
| `nim_status` | Status da cota de 40 RPM e catálogo de modelos | — |

---

## 🚀 Instalação e Execução

### 1. Pré-requisitos
- **Node.js** `>= 20.x` (testado no Node 24)
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

Ao usar a ferramenta `nim_consultar_modelo`, você pode passar diretamente o alias no parâmetro `modelo`:

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

## 🛡️ Rate Limiting Inteligente (Sliding Window 40 RPM)

O servidor implementa um limitador de janela deslizante em memória:
- Registra os timestamps de cada requisição nos últimos 60 segundos.
- Caso o limite de 40 requisições seja atingido, a próxima chamada aguarda automaticamente a liberação do slot mais antigo com backoff suave.
- Trata respostas `429 Too Many Requests` com retentativas exponenciais automáticas.

---

## 📄 Licença

Distribuído sob a licença [MIT](LICENSE).
