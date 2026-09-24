import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServerFn } from "@tanstack/react-start";

const MAX_BYTES = 8_000_000;

function safeName(name: string) {
  const ext = name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "bin";
  return `lease.${ext}`;
}

function runMarkitdown(filePath: string) {
  return new Promise<string>((resolve, reject) => {
    const script = join(process.cwd(), "scripts", "markitdown-convert.mjs");
    const child = spawn(process.execPath, [script, filePath], { cwd: process.cwd() });
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("MarkItDown took too long."));
    }, 45000);
    child.stdout.on("data", (chunk) => out.push(chunk as Buffer));
    child.stderr.on("data", (chunk) => err.push(chunk as Buffer));
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(Buffer.concat(out).toString("utf8"));
      else reject(new Error(Buffer.concat(err).toString("utf8").trim() || "MarkItDown failed."));
    });
  });
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
      const text = (await runMarkitdown(filePath)).trim();
      if (text.length < 20) return { ok: false as const, error: "MarkItDown found no readable text." };
      return { ok: true as const, text };
    } catch (err) {
      const message = err instanceof Error ? err.message : "MarkItDown failed.";
      return { ok: false as const, error: message.slice(0, 300) };
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
