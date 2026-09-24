import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServerFn } from "@tanstack/react-start";

const MAX_BYTES = 8_000_000;

function safeName(name: string) {
  const ext = name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "bin";
  return `lease.${ext}`;
}

export const markitdownConvert = createServerFn({ method: "POST" })
  .validator((input: { name?: string; base64?: string }) => ({
    name: safeName(String(input?.name ?? "lease.bin")),
    base64: String(input?.base64 ?? ""),
  }))
  .handler(async ({ data }) => {
    if (!data.base64 || data.base64.length > 12_000_000) {
      return { ok: false as const, error: "That file is empty or too large for MarkItDown." };
    }
    const bytes = Buffer.from(data.base64, "base64");
    if (!bytes.length || bytes.length > MAX_BYTES) {
      return { ok: false as const, error: "That file is empty or too large for MarkItDown." };
    }
    const dir = await mkdtemp(join(tmpdir(), "proviso-"));
    try {
      const filePath = join(dir, data.name);
      await writeFile(filePath, bytes);
      const mod = (await import("markitdown-js")) as {
        default: new () => { convert: (path: string) => Promise<{ textContent?: string }> };
      };
      const result = await new mod.default().convert(filePath);
      const text = String(result?.textContent ?? "").trim();
      if (text.length < 20) return { ok: false as const, error: "MarkItDown found no readable text." };
      return { ok: true as const, text };
    } catch (err) {
      const message = err instanceof Error ? err.message : "MarkItDown failed.";
      return { ok: false as const, error: message.slice(0, 300) };
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
