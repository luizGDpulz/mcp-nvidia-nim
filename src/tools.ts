import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { NimClient } from "./client.js";
import { KNOWN_MODELS, MODEL_ALIASES, resolveModel } from "./models.js";
import { formatTextToolResponse, formatJsonToolResponse, formatToolError, resolveImageInput } from "./utils.js";

export function registerNimTools(server: McpServer, client: NimClient): void {
  // 1. General model query
  server.tool(
    "nim_query_model",
    "Executes a direct prompt query against any NVIDIA NIM model (e.g. Nemotron Ultra 550B, Mistral Large, MiniMax Flash, etc.)",
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
    },
    async ({ prompt, model, system_prompt, temperature, max_tokens }) => {
      try {
        const resolved = resolveModel(model);
        const startTime = Date.now();
        const responseText = await client.quickPrompt(prompt, {
          model: resolved,
          systemPrompt: system_prompt,
          temperature,
          maxTokens: max_tokens,
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
    "Leverages NVIDIA large-scale reasoning models (Nemotron-3 Ultra 550B or Nemotron-3 Omni Reasoning) for deep system architecture, complex logic, and tradeoff analysis",
    {
      problem: z.string().describe("The core technical challenge, logical problem, or architectural dilemma to analyze."),
      context: z.string().optional().describe("Additional technical context, requirements, existing code, or constraints."),
      mode: z
        .enum(["ultra", "fast"])
        .optional()
        .describe("Reasoning mode: 'ultra' uses the 550B-parameter Nemotron Ultra; 'fast' uses Omni 30B Reasoning. Default: 'ultra'."),
    },
    async ({ problem, context, mode }) => {
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
    "Audits source code or git diffs using software engineering specialist models (Poolside Laguna XS or Mistral Large)",
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
    },
    async ({ code_or_diff, language, focus, model }) => {
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
    },
    async ({ image_url_or_path, prompt, model }) => {
      try {
        const resolved = resolveModel(model || "vision");
        const resolvedImage = await resolveImageInput(image_url_or_path);

        const startTime = Date.now();
        const response = await client.chatCompletion({
          model: resolved,
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                { type: "image_url", image_url: { url: resolvedImage } },
              ],
            },
          ],
          temperature: 0.2,
          max_tokens: 3000,
        });
        const elapsedMs = Date.now() - startTime;

        const choiceText = response.choices?.[0]?.message?.content || "(No text generated)";
        return formatTextToolResponse(
          `### NVIDIA NIM Visual Analysis [${resolved}] (${elapsedMs}ms):\n\n${choiceText}`
        );
      } catch (err) {
        return formatToolError("Error during visual analysis", err);
      }
    }
  );

  // 5. Document & Data Extraction
  server.tool(
    "nim_extract_document",
    "Processes and structures raw dumps from PDFs, tables, unorganized notes, or OCR using Nemotron Parse 2.0",
    {
      raw_content: z.string().describe("Raw unformatted content, PDF text dump, or OCR to parse."),
      target_format: z
        .enum(["markdown", "json", "table"])
        .optional()
        .describe("Desired output format. Default: 'markdown'."),
    },
    async ({ raw_content, target_format }) => {
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

  // 6. Server Telemetry & Status
  server.tool(
    "nim_status",
    "Reports rate limiting status (40 RPM quota), available slots, and supported model catalog and aliases",
    {},
    async () => {
      try {
        const rateLimit = client.getRateLimiterStatus();
        return formatJsonToolResponse({
          rateLimit: {
            ...rateLimit,
            statusDescription: `${rateLimit.currentRpm}/${rateLimit.limit} requests in the last 60s (${rateLimit.availableSlots} slots available)`,
          },
          availableAliases: MODEL_ALIASES,
          supportedModels: KNOWN_MODELS,
        });
      } catch (err) {
        return formatToolError("Error fetching status", err);
      }
    }
  );
}
