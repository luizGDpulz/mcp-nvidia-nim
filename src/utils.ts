import fs from "node:fs/promises";
import path from "node:path";

export function formatJsonToolResponse(data: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}

export function formatTextToolResponse(text: string) {
  return {
    content: [
      {
        type: "text" as const,
        text,
      },
    ],
  };
}

export function formatToolError(prefix: string, err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  return {
    isError: true,
    content: [
      {
        type: "text" as const,
        text: `${prefix}: ${message}`,
      },
    ],
  };
}

export async function resolveImageInput(input: string): Promise<string> {
  const trimmed = input.trim();

  // If already an HTTP/HTTPS URL or Data URI base64
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("data:image/")) {
    return trimmed;
  }

  // Check if it's an existing local file
  try {
    const resolvedPath = path.resolve(trimmed);
    const stat = await fs.stat(resolvedPath);
    if (!stat.isFile()) {
      throw new Error(`Path is not a valid file: ${trimmed}`);
    }

    const ext = path.extname(resolvedPath).toLowerCase().replace(".", "");
    const mimeMap: Record<string, string> = {
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      webp: "image/webp",
      gif: "image/gif",
    };
    const mime = mimeMap[ext] || "image/png";

    const buffer = await fs.readFile(resolvedPath);
    const base64 = buffer.toString("base64");
    return `data:${mime};base64,${base64}`;
  } catch (err) {
    throw new Error(`Could not load specified image ('${trimmed}'): ${(err as Error).message}`);
  }
}
