import fs from "node:fs/promises";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";

const PRINCIPLES_DIR = path.join(process.cwd(), "principles");
const CACHE_TTL_MS = 5 * 60_000;

type CacheEntry = {
  text: string;
  signature: string;
  cachedAt: number;
};

let cache: CacheEntry | null = null;

async function currentSignature(): Promise<string> {
  try {
    const entries = await fs.readdir(PRINCIPLES_DIR);
    const stats = await Promise.all(
      entries
        .filter((name) => /\.(pdf|txt|md)$/i.test(name) && name !== "README.md")
        .map(async (name) => {
          const full = path.join(PRINCIPLES_DIR, name);
          const stat = await fs.stat(full);
          return `${name}:${stat.size}:${stat.mtimeMs}`;
        })
    );
    return stats.sort().join("|");
  } catch {
    return "";
  }
}

async function readFileText(name: string, absPath: string): Promise<string> {
  if (name.toLowerCase().endsWith(".pdf")) {
    const buffer = await fs.readFile(absPath);
    const pdfParseModule = await import("pdf-parse");
    const pdfParse =
      (pdfParseModule as { default?: (buf: Buffer) => Promise<{ text: string }> }).default ??
      (pdfParseModule as unknown as (buf: Buffer) => Promise<{ text: string }>);
    const parsed = await pdfParse(buffer);
    return parsed.text?.trim() ?? "";
  }
  const text = await fs.readFile(absPath, "utf-8");
  return text.trim();
}

export async function loadPrinciplesText(): Promise<string> {
  const signature = await currentSignature();
  if (cache && cache.signature === signature && Date.now() - cache.cachedAt < CACHE_TTL_MS) {
    return cache.text;
  }

  let text = "";
  try {
    const entries = await fs.readdir(PRINCIPLES_DIR);
    const files = entries
      .filter((name) => /\.(pdf|txt|md)$/i.test(name) && name !== "README.md")
      .sort();
    const chunks: string[] = [];
    for (const name of files) {
      const full = path.join(PRINCIPLES_DIR, name);
      try {
        const body = await readFileText(name, full);
        if (body) chunks.push(`## ${name}\n\n${body}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        chunks.push(`## ${name}\n\n[could not parse: ${message}]`);
      }
    }
    text = chunks.join("\n\n---\n\n");
  } catch {
    text = "";
  }

  cache = { text, signature, cachedAt: Date.now() };
  return text;
}

/**
 * Return an Anthropic system-prompt block with coaching principles,
 * or null if none are configured. The block uses prompt caching so
 * repeated calls are cheap.
 */
export async function buildPrinciplesBlock(): Promise<
  Anthropic.TextBlockParam | null
> {
  const text = await loadPrinciplesText();
  if (!text) return null;
  const block = {
    type: "text" as const,
    text: `You must base recommendations on the coaching principles below. When you apply a specific principle, briefly cite the file name it came from (e.g. "from couzens-base.pdf …"). If the principles conflict with the athlete's stated goals, flag the tension in chat rather than silently overriding.\n\n${text}`,
    cache_control: { type: "ephemeral" as const }
  };
  return block as Anthropic.TextBlockParam;
}
