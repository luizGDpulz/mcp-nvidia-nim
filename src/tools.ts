import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { NimClient } from "./client.js";
import { KNOWN_MODELS, MODEL_ALIASES, resolveModel } from "./models.js";
import { formatTextToolResponse, formatJsonToolResponse, formatToolError, resolveImageInput } from "./utils.js";

export function registerNimTools(server: McpServer, client: NimClient): void {
  // 1. Consulta geral a qualquer modelo
  server.tool(
    "nim_consultar_modelo",
    "Executa uma consulta direta a qualquer modelo da NVIDIA NIM (ex: Nemotron Ultra 550B, Mistral Large, MiniMax Flash, etc.)",
    {
      prompt: z.string().describe("Mensagem ou pergunta a ser enviada ao modelo."),
      modelo: z
        .string()
        .optional()
        .describe(
          "Nome completo ou alias do modelo: 'ultra', 'mistral', 'reasoning', 'fast', 'flash', 'code', 'vision', etc. Padrão: 'mistral'."
        ),
      system_prompt: z.string().optional().describe("Prompt de sistema com instruções comportamentais ou restrições."),
      temperature: z.number().min(0).max(2).optional().describe("Temperatura da geração (0.0 = determinístico, 1.0+ = criativo). Padrão: 0.2."),
      max_tokens: z.number().positive().max(16384).optional().describe("Limite máximo de tokens de resposta. Padrão: 2048."),
    },
    async ({ prompt, modelo, system_prompt, temperature, max_tokens }) => {
      try {
        const resolved = resolveModel(modelo);
        const startTime = Date.now();
        const responseText = await client.quickPrompt(prompt, {
          model: resolved,
          systemPrompt: system_prompt,
          temperature,
          maxTokens: max_tokens,
        });
        const elapsedMs = Date.now() - startTime;

        return formatTextToolResponse(
          `### Resposta do NVIDIA NIM [${resolved}] (${elapsedMs}ms):\n\n${responseText}`
        );
      } catch (err) {
        return formatToolError("Erro ao consultar modelo NVIDIA NIM", err);
      }
    }
  );

  // 2. Raciocínio Profundo & Arquitetura
  server.tool(
    "nim_raciocinar_profundo",
    "Aciona os modelos de raciocínio de alta escala da NVIDIA (Nemotron-3 Ultra 550B ou Nemotron-3 Omni Reasoning) para arquitetura de software, lógica complexa e análise de tradeoffs",
    {
      problema: z.string().describe("O desafio lógico, decisão arquitetural ou problema a ser decomposto e resolvido."),
      contexto: z.string().optional().describe("Contexto técnico adicional, restrições, padrões de projeto ou trechos de código."),
      modo: z
        .enum(["ultra", "fast"])
        .optional()
        .describe("Modo de raciocínio: 'ultra' usa o monstro de 550B de parâmetros (Nemotron Ultra); 'fast' usa o modelo Omni 30B Reasoning."),
    },
    async ({ problema, contexto, modo }) => {
      try {
        const selectedModel = modo === "fast" ? "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning" : "nvidia/nemotron-3-ultra-550b-a55b";
        const systemPrompt =
          "Você é um engenheiro de software e arquiteto de sistemas sênior da NVIDIA. Analise o problema com rigor matemático e técnico extremo. Decomponha os tradeoffs, identifique potenciais falhas de concorrência ou segurança e entregue uma solução arquiteturalmente impecável.";

        const promptText = contexto
          ? `### Contexto e Restrições Técnicas:\n${contexto}\n\n### Problema a Resolver:\n${problema}`
          : problema;

        const startTime = Date.now();
        const responseText = await client.quickPrompt(promptText, {
          model: selectedModel,
          systemPrompt,
          temperature: 0.1,
          maxTokens: 4096,
        });
        const elapsedMs = Date.now() - startTime;

        return formatTextToolResponse(
          `### Parecer do Conselho de Arquitetura NIM [${selectedModel}] (${elapsedMs}ms):\n\n${responseText}`
        );
      } catch (err) {
        return formatToolError("Erro ao executar raciocínio profundo", err);
      }
    }
  );

  // 3. Revisão de Código Especializada
  server.tool(
    "nim_revisar_codigo",
    "Audita código-fonte ou git diffs usando o modelo especializado em engenharia de software Poolside Laguna XS ou Mistral Large",
    {
      codigo_ou_diff: z.string().describe("O código-fonte ou git diff a ser auditado."),
      linguagem: z.string().optional().describe("Linguagem de programação (ex: typescript, python, rust, go, bash, docker)."),
      foco: z
        .enum(["bugs_e_seguranca", "performance", "arquitetura_e_padroes", "geral"])
        .optional()
        .describe("Área de foco da auditoria. Padrão: 'geral'."),
      modelo: z
        .string()
        .optional()
        .describe("Modelo a usar: 'code' (Poolside Laguna XS 2.1) ou 'mistral' (Mistral Large 4). Padrão: 'code'."),
    },
    async ({ codigo_ou_diff, linguagem, foco, modelo }) => {
      try {
        const resolved = resolveModel(modelo || "code");
        const focoStr = foco ? ` com foco prioritário em '${foco.replace(/_/g, " ")}'` : "";
        const langStr = linguagem ? ` na linguagem ${linguagem}` : "";

        const systemPrompt = `Você é um auditor sênior de código open-source${langStr}. Analise o código ou git diff fornecido${focoStr}. Aponte bugs críticos, vazamentos de recursos, falhas de segurança, antipadrões e melhorias concretas com exemplos de código corrigido. Seja cirúrgico e direto ao ponto.`;

        const startTime = Date.now();
        const responseText = await client.quickPrompt(codigo_ou_diff, {
          model: resolved,
          systemPrompt,
          temperature: 0.1,
          maxTokens: 4096,
        });
        const elapsedMs = Date.now() - startTime;

        return formatTextToolResponse(
          `### Relatório de Auditoria de Código NIM [${resolved}] (${elapsedMs}ms):\n\n${responseText}`
        );
      } catch (err) {
        return formatToolError("Erro na revisão de código", err);
      }
    }
  );

  // 4. Análise Visual e Multimodal
  server.tool(
    "nim_analisar_visao",
    "Analisa imagens, diagramas técnicos, prints de tela e wireframes usando modelos de grande porte como Llama 3.2 90B Vision ou Nemotron Super VL 120B",
    {
      imagem_url_ou_arquivo: z
        .string()
        .describe("URL da imagem (http/https), caminho absoluto de arquivo local no host (ex: /path/to/img.png) ou Data URI em base64."),
      pergunta: z.string().describe("Pergunta ou instrução detalhada sobre a imagem."),
      modelo: z
        .string()
        .optional()
        .describe("Modelo multimodal a usar: 'vision' (Llama 3.2 90B Vision) ou 'super-vl' (Nemotron Super VL 120B). Padrão: 'vision'."),
    },
    async ({ imagem_url_ou_arquivo, pergunta, modelo }) => {
      try {
        const resolved = resolveModel(modelo || "vision");
        const resolvedImage = await resolveImageInput(imagem_url_ou_arquivo);

        const startTime = Date.now();
        const response = await client.chatCompletion({
          model: resolved,
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: pergunta },
                { type: "image_url", image_url: { url: resolvedImage } },
              ],
            },
          ],
          temperature: 0.2,
          max_tokens: 3000,
        });
        const elapsedMs = Date.now() - startTime;

        const choiceText = response.choices?.[0]?.message?.content || "(Sem texto gerado)";
        return formatTextToolResponse(
          `### Análise Visual NVIDIA NIM [${resolved}] (${elapsedMs}ms):\n\n${choiceText}`
        );
      } catch (err) {
        return formatToolError("Erro na análise visual", err);
      }
    }
  );

  // 5. Extração e Parsing de Documentos Complexos
  server.tool(
    "nim_extrair_documento",
    "Processa e estrutura conteúdos brutos de PDFs, tabelas, notas desorganizadas ou logs usando o especialista Nemotron Parse 2.0",
    {
      conteudo_bruto: z.string().describe("O conteúdo bruto ou desestruturado a ser parseado."),
      formato_desejado: z
        .enum(["markdown", "json", "tabela"])
        .optional()
        .describe("Formato de saída desejado. Padrão: 'markdown'."),
    },
    async ({ conteudo_bruto, formato_desejado }) => {
      try {
        const resolved = resolveModel("parse");
        const formato = formato_desejado || "markdown";
        const systemPrompt = `Você é um extrator semântico avançado (Nemotron Parse). Converta o conteúdo bruto a seguir estritamente para formato ${formato.toUpperCase()}, preservando hierarquia, números, tabelas e removendo ruídos.`;

        const startTime = Date.now();
        const responseText = await client.quickPrompt(conteudo_bruto, {
          model: resolved,
          systemPrompt,
          temperature: 0.1,
          maxTokens: 4096,
        });
        const elapsedMs = Date.now() - startTime;

        return formatTextToolResponse(
          `### Documento Estruturado [${resolved}] (${elapsedMs}ms):\n\n${responseText}`
        );
      } catch (err) {
        return formatToolError("Erro na extração de documento", err);
      }
    }
  );

  // 6. Status do Servidor e Catálogo
  server.tool(
    "nim_status",
    "Informa o consumo da cota de Rate Limiting (40 RPM), slots livres e a lista de modelos homologados e aliases disponíveis",
    {},
    async () => {
      try {
        const rateLimit = client.getRateLimiterStatus();
        return formatJsonToolResponse({
          rateLimit: {
            ...rateLimit,
            statusDescricao: `${rateLimit.currentRpm}/${rateLimit.limit} requisições nos últimos 60s (${rateLimit.availableSlots} slots livres)`,
          },
          aliasesDisponiveis: MODEL_ALIASES,
          modelosHomologados: KNOWN_MODELS,
        });
      } catch (err) {
        return formatToolError("Erro ao obter status", err);
      }
    }
  );
}
