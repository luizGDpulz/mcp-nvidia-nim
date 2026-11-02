import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { NimClient } from "./client.js";
import { KNOWN_MODELS, MODEL_ALIASES, MODEL_FALLBACK_CHAINS, resolveModel } from "./models.js";
import { formatTextToolResponse, formatJsonToolResponse, formatToolError, resolveImageInput } from "./utils.js";

export function registerNimTools(server: McpServer, client: NimClient): void {
  // =========================================================================
  // Primary Tools (English Naming Standard)
  // =========================================================================

  // 1. General model query with fallback
  server.tool(
    "nim_query_model",
    "Executes a direct prompt query against any NVIDIA NIM model (e.g. Nemotron Ultra 550B, Mistral Large, MiniMax Flash, etc.) with automatic fallback failover",
    {
      prompt: z.string().describe("User prompt or instruction to send to the model."),
      model: z
        .string()
        .optional()
        .describe(
          "Full model identifier or alias: 'ultra', 'mistral', 'reasoning', 'fast', 'flash', 'code', 'vision', etc. Default: 'mistral'."
        ),
      system_prompt: z.string().optional().describe("Optional system prompt with behavioral guidelines or persona."),
      temperature: z.number().min(0).max(2).optional().describe("Sampling temperature (0.0 = deterministic, 1.0+ = creative). Default: 0.2."),
      max_tokens: z.number().positive().max(16384).optional().describe("Maximum completion tokens. Default: 2048."),
      enable_fallback: z.boolean().optional().describe("Whether to automatically try fallback models if primary model fails. Default: true."),
    },
    async ({ prompt, model, system_prompt, temperature, max_tokens, enable_fallback }) => {
      try {
        const resolved = resolveModel(model);
        const startTime = Date.now();
        const responseText = await client.quickPrompt(prompt, {
          model: resolved,
          systemPrompt: system_prompt,
          temperature,
          maxTokens: max_tokens,
          enableFallback: enable_fallback ?? true,
        });
        const elapsedMs = Date.now() - startTime;

        return formatTextToolResponse(
          `### NVIDIA NIM Response [${resolved}] (${elapsedMs}ms):\n\n${responseText}`
        );
      } catch (err) {
        return formatToolError("Error querying NVIDIA NIM model", err);
      }
    }
  );

  // 2. Deep Reasoning & Architecture
  server.tool(
    "nim_deep_reason",
    "Leverages NVIDIA large-scale reasoning models (Nemotron-3 Ultra 550B or Nemotron-3 Omni Reasoning) for deep system architecture, complex logic, and tradeoff analysis with automatic failover",
    {
      problem: z.string().describe("The core technical challenge, logical problem, or architectural dilemma to analyze."),
      context: z.string().optional().describe("Additional technical context, requirements, existing code, or constraints."),
      mode: z
        .enum(["ultra", "fast"])
        .optional()
        .describe("Reasoning mode: 'ultra' uses the 550B-parameter Nemotron Ultra; 'fast' uses Omni 30B Reasoning. Default: 'ultra'."),
      enable_fallback: z.boolean().optional().describe("Whether to failover to sibling reasoning models if primary is unavailable. Default: true."),
    },
    async ({ problem, context, mode, enable_fallback }) => {
      try {
        const selectedModel = mode === "fast" ? "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning" : "nvidia/nemotron-3-ultra-550b-a55b";
        const systemPrompt =
          "You are a Principal Software Engineer and Systems Architect at NVIDIA. Analyze the problem with extreme technical and mathematical rigor. Deconstruct tradeoffs, identify potential concurrency or security bottlenecks, and deliver an impeccable architectural solution.";

        const promptText = context
          ? `### Technical Context and Constraints:\n${context}\n\n### Problem to Solve:\n${problem}`
          : problem;

        const startTime = Date.now();
        const responseText = await client.quickPrompt(promptText, {
          model: selectedModel,
          systemPrompt,
          temperature: 0.1,
          maxTokens: 4096,
          enableFallback: enable_fallback ?? true,
        });
        const elapsedMs = Date.now() - startTime;

        return formatTextToolResponse(
          `### NIM Architecture Advisory [${selectedModel}] (${elapsedMs}ms):\n\n${responseText}`
        );
      } catch (err) {
        return formatToolError("Error executing deep reasoning", err);
      }
    }
  );

  // 3. Specialized Code Review
  server.tool(
    "nim_review_code",
    "Audits source code or git diffs using software engineering specialist models (Poolside Laguna XS or Mistral Large) with automatic fallback",
    {
      code_or_diff: z.string().describe("Source code or git diff to audit."),
      language: z.string().optional().describe("Programming language (e.g. typescript, python, rust, go, bash, docker)."),
      focus: z
        .enum(["bugs_and_security", "performance", "architecture_and_patterns", "general"])
        .optional()
        .describe("Audit focus area. Default: 'general'."),
      model: z
        .string()
        .optional()
        .describe("Model to use: 'code' (Poolside Laguna XS 2.1) or 'mistral' (Mistral Large 4). Default: 'code'."),
      enable_fallback: z.boolean().optional().describe("Whether to failover if code model is unavailable. Default: true."),
    },
    async ({ code_or_diff, language, focus, model, enable_fallback }) => {
      try {
        const resolved = resolveModel(model || "code");
        const focusStr = focus ? ` with primary focus on '${focus.replace(/_/g, " ")}'` : "";
        const langStr = language ? ` in ${language}` : "";

        const systemPrompt = `You are a Senior Open-Source Code Auditor${langStr}. Review the provided code or git diff${focusStr}. Identify critical bugs, resource leaks, security flaws, antipatterns, and recommend concrete fixes with clear code examples. Be surgical, precise, and concise.`;

        const startTime = Date.now();
        const responseText = await client.quickPrompt(code_or_diff, {
          model: resolved,
          systemPrompt,
          temperature: 0.1,
          maxTokens: 4096,
          enableFallback: enable_fallback ?? true,
        });
        const elapsedMs = Date.now() - startTime;

        return formatTextToolResponse(
          `### NIM Code Audit Report [${resolved}] (${elapsedMs}ms):\n\n${responseText}`
        );
      } catch (err) {
        return formatToolError("Error during code review", err);
      }
    }
  );

  // 4. Multimodal Vision Analysis
  server.tool(
    "nim_analyze_vision",
    "Analyzes images, architecture diagrams, screenshots, and wireframes using large multimodal models (Llama 3.2 90B Vision or Nemotron Super VL 120B)",
    {
      image_url_or_path: z
        .string()
        .describe("Image URL (http/https), local absolute filesystem path (e.g. /path/to/image.png), or base64 data URI."),
      prompt: z.string().describe("Question, instruction, or prompt regarding the visual input."),
      model: z
        .string()
        .optional()
        .describe("Multimodal model: 'vision' (Llama 3.2 90B Vision) or 'super-vl' (Nemotron Super VL 120B). Default: 'vision'."),
      enable_fallback: z.boolean().optional().describe("Whether to failover to sibling vision model. Default: true."),
    },
    async ({ image_url_or_path, prompt, model, enable_fallback }) => {
      try {
        const resolved = resolveModel(model || "vision");
        const resolvedImage = await resolveImageInput(image_url_or_path);

        const startTime = Date.now();
        const messages = [
          {
            role: "user" as const,
            content: [
              { type: "text" as const, text: prompt },
              { type: "image_url" as const, image_url: { url: resolvedImage } },
            ],
          },
        ];

        let choiceText = "";
        let finalModel = resolved;

        if (enable_fallback ?? true) {
          const res = await client.chatCompletionWithFallback({
            model: resolved,
            messages,
            temperature: 0.2,
            max_tokens: 3000,
          });
          finalModel = res.modelUsed;
          choiceText = res.response.choices?.[0]?.message?.content || "(No text generated)";
          if (res.fallbackTriggered) {
            choiceText = `> ⚠️ **[Vision Fallback]** Primary model \`${res.requestedModel}\` unavailable. Switched to \`${res.modelUsed}\`.\n\n${choiceText}`;
          }
        } else {
          const res = await client.chatCompletion({
            model: resolved,
            messages,
            temperature: 0.2,
            max_tokens: 3000,
          });
          choiceText = res.choices?.[0]?.message?.content || "(No text generated)";
        }

        const elapsedMs = Date.now() - startTime;
        return formatTextToolResponse(
          `### NVIDIA NIM Visual Analysis [${finalModel}] (${elapsedMs}ms):\n\n${choiceText}`
        );
      } catch (err) {
        return formatToolError("Error during visual analysis", err);
      }
    }
  );

  // 5. Document & Data Extraction
  server.tool(
    "nim_extract_document",
    "Processes and structures raw dumps from PDFs, tables, unorganized notes, or OCR using Nemotron Parse 2.0 with automatic failover",
    {
      raw_content: z.string().describe("Raw unformatted content, PDF text dump, or OCR to parse."),
      target_format: z
        .enum(["markdown", "json", "table"])
        .optional()
        .describe("Desired output format. Default: 'markdown'."),
      enable_fallback: z.boolean().optional().describe("Whether to failover if parse model is unavailable. Default: true."),
    },
    async ({ raw_content, target_format, enable_fallback }) => {
      try {
        const resolved = resolveModel("parse");
        const format = target_format || "markdown";
        const systemPrompt = `You are an advanced semantic extractor (Nemotron Parse). Convert the following raw content strictly into ${format.toUpperCase()} format, preserving hierarchy, numbers, and tabular data while eliminating noise.`;

        const startTime = Date.now();
        const responseText = await client.quickPrompt(raw_content, {
          model: resolved,
          systemPrompt,
          temperature: 0.1,
          maxTokens: 4096,
          enableFallback: enable_fallback ?? true,
        });
        const elapsedMs = Date.now() - startTime;

        return formatTextToolResponse(
          `### Structured Document [${resolved}] (${elapsedMs}ms):\n\n${responseText}`
        );
      } catch (err) {
        return formatToolError("Error extracting document", err);
      }
    }
  );

  // 6. Proactive Catalog Health Check
  server.tool(
    "nim_health_check",
    "Runs diagnostic ping probes across homologated NVIDIA NIM models to detect entitlement changes, deprecations, or latency degradation",
    {
      models: z
        .array(z.string())
        .optional()
        .describe("Optional list of specific model IDs or aliases to test. If omitted, tests essential catalog models."),
      timeout_ms: z.number().min(1000).max(30000).optional().describe("Timeout per probe in milliseconds. Default: 6000."),
      force: z
        .boolean()
        .optional()
        .describe("Force live probe bypassing TTL cache and quota safety floor. Default: false."),
    },
    async ({ models, timeout_ms, force }) => {
      try {
        const report = await client.probeCatalog({
          models,
          timeoutMs: timeout_ms,
          force,
        });

        const rows = report.results.map((r) => {
          const icon = r.status === "healthy" ? "🟢 Healthy" : r.status === "degraded" ? "🟡 Degraded" : "🔴 Unavailable";
          const fallback = MODEL_FALLBACK_CHAINS[r.model]?.[0] || "(none)";
          const statusDetail = r.statusCode ? `HTTP ${r.statusCode}` : r.error?.slice(0, 40) || "-";
          return `| \`${r.model}\` | ${icon} | ${statusDetail} | ${r.latencyMs}ms | \`${fallback}\` |`;
        });

        const cacheBadge = report.fromCache ? " ⚡ *(Cached TTL Fresh)*" : " 🌐 *(Live Probe)*";
        const quotaNotice = report.quotaMessage ? `> 🛡️ **Quota Guardrail:** ${report.quotaMessage}\n\n` : "";

        const markdown = [
          `### 🏥 NVIDIA NIM Catalog Health Report (${report.timestamp})${cacheBadge}`,
          "",
          quotaNotice,
          `**Summary:** ${report.healthyCount} Healthy | ${report.degradedCount} Degraded | ${report.unavailableCount} Unavailable (${report.totalTested} tested)`,
          "",
          "| Model ID | Status | Response | Latency | Fallback Target |",
          "| :--- | :---: | :---: | :---: | :--- |",
          ...rows,
          "",
          report.unavailableCount > 0
            ? `> ⚠️ **Warning:** ${report.unavailableCount} model(s) are currently unavailable on your NVIDIA account. Any calls to these models will automatically failover via Fallback Chains.`
            : "> ✅ **All tested endpoints are active and entitled.**",
        ].filter(Boolean).join("\n");

        return formatTextToolResponse(markdown);
      } catch (err) {
        return formatToolError("Error running health check", err);
      }
    }
  );

  // 7. Server Telemetry & Status
  server.tool(
    "nim_status",
    "Reports rate limiting status (40 RPM quota), available slots, execution telemetry, fallback chains, and supported models",
    {},
    async () => {
      try {
        const rateLimit = client.getRateLimiterStatus();
        const telemetry = client.getTelemetry();
        const quotaProtection = client.getProtectionConfig();
        return formatJsonToolResponse({
          rateLimit: {
            ...rateLimit,
            statusDescription: `${rateLimit.currentRpm}/${rateLimit.limit} requests in the last 60s (${rateLimit.availableSlots} slots available)`,
          },
          quotaProtection,
          telemetry,
          fallbackChains: MODEL_FALLBACK_CHAINS,
          availableAliases: MODEL_ALIASES,
          supportedModels: KNOWN_MODELS,
        });
      } catch (err) {
        return formatToolError("Error fetching status", err);
      }
    }
  );

  // =========================================================================
  // Backward-Compatible Aliases (Portuguese)
  // =========================================================================

  server.tool(
    "nim_verificar_saude",
    "Alias para nim_health_check (compatibilidade com versões anteriores)",
    {
      modelos: z.array(z.string()).optional(),
      forcar: z.boolean().optional().describe("Forçar teste em tempo real ignorando cache e reserva de quota. Padrão: false."),
    },
    async ({ modelos, forcar }) => {
      const report = await client.probeCatalog({
        models: modelos,
        force: forcar,
      });
      return formatJsonToolResponse(report);
    }
  );

  server.tool(
    "nim_consultar_modelo",
    "Alias para nim_query_model (compatibilidade com versões anteriores)",
    {
      prompt: z.string(),
      modelo: z.string().optional(),
      system_prompt: z.string().optional(),
      temperature: z.number().min(0).max(2).optional(),
      max_tokens: z.number().positive().max(16384).optional(),
    },
    async ({ prompt, modelo, system_prompt, temperature, max_tokens }) => {
      const resolved = resolveModel(modelo);
      const startTime = Date.now();
      try {
        const res = await client.quickPrompt(prompt, {
          model: resolved,
          systemPrompt: system_prompt,
          temperature,
          maxTokens: max_tokens,
        });
        return formatTextToolResponse(`### Resposta NIM [${resolved}] (${Date.now() - startTime}ms):\n\n${res}`);
      } catch (err) {
        return formatToolError("Erro ao consultar modelo", err);
      }
    }
  );

  server.tool(
    "nim_raciocinar_profundo",
    "Alias para nim_deep_reason (compatibilidade com versões anteriores)",
    {
      problema: z.string(),
      contexto: z.string().optional(),
      modo: z.enum(["ultra", "fast"]).optional(),
    },
    async ({ problema, contexto, modo }) => {
      const selectedModel = modo === "fast" ? "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning" : "nvidia/nemotron-3-ultra-550b-a55b";
      const promptText = contexto ? `Contexto:\n${contexto}\n\nProblema:\n${problema}` : problema;
      const startTime = Date.now();
      try {
        const res = await client.quickPrompt(promptText, { model: selectedModel, temperature: 0.1, maxTokens: 4096 });
        return formatTextToolResponse(`### Parecer NIM [${selectedModel}] (${Date.now() - startTime}ms):\n\n${res}`);
      } catch (err) {
        return formatToolError("Erro no raciocínio profundo", err);
      }
    }
  );

  server.tool(
    "nim_revisar_codigo",
    "Alias para nim_review_code (compatibilidade com versões anteriores)",
    {
      codigo_ou_diff: z.string(),
      linguagem: z.string().optional(),
      foco: z.enum(["bugs_e_seguranca", "performance", "arquitetura_e_padroes", "geral"]).optional(),
      modelo: z.string().optional(),
    },
    async ({ codigo_ou_diff, linguagem, foco, modelo }) => {
      const resolved = resolveModel(modelo || "code");
      const startTime = Date.now();
      try {
        const res = await client.quickPrompt(codigo_ou_diff, {
          model: resolved,
          systemPrompt: `Auditor sênior de código (${linguagem || "geral"}). Foco: ${foco || "geral"}.`,
          temperature: 0.1,
          maxTokens: 4096,
        });
        return formatTextToolResponse(`### Relatório de Auditoria NIM [${resolved}] (${Date.now() - startTime}ms):\n\n${res}`);
      } catch (err) {
        return formatToolError("Erro na revisão de código", err);
      }
    }
  );

  server.tool(
    "nim_analisar_visao",
    "Alias para nim_analyze_vision (compatibilidade com versões anteriores)",
    {
      imagem_url_ou_arquivo: z.string(),
      pergunta: z.string(),
      modelo: z.string().optional(),
    },
    async ({ imagem_url_ou_arquivo, pergunta, modelo }) => {
      const resolved = resolveModel(modelo || "vision");
      const startTime = Date.now();
      try {
        const resolvedImage = await resolveImageInput(imagem_url_ou_arquivo);
        const res = await client.chatCompletionWithFallback({
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
        });
        const content = res.response.choices?.[0]?.message?.content || "";
        return formatTextToolResponse(`### Análise Visual NIM [${res.modelUsed}] (${Date.now() - startTime}ms):\n\n${content}`);
      } catch (err) {
        return formatToolError("Erro na análise visual", err);
      }
    }
  );

  server.tool(
    "nim_extrair_documento",
    "Alias para nim_extract_document (compatibilidade com versões anteriores)",
    {
      conteudo_bruto: z.string(),
      formato_desejado: z.enum(["markdown", "json", "tabela"]).optional(),
    },
    async ({ conteudo_bruto, formato_desejado }) => {
      const resolved = resolveModel("parse");
      const startTime = Date.now();
      try {
        const res = await client.quickPrompt(conteudo_bruto, {
          model: resolved,
          systemPrompt: `Extraia e estruture em formato ${formato_desejado || "markdown"}.`,
          maxTokens: 4096,
        });
        return formatTextToolResponse(`### Documento Estruturado [${resolved}] (${Date.now() - startTime}ms):\n\n${res}`);
      } catch (err) {
        return formatToolError("Erro na extração de documento", err);
      }
    }
  );
}
