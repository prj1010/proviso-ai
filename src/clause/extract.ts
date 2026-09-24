import { extractPdfText } from "@/clause/pdf";

const TEXT_EXT = new Set(["txt", "text", "md", "csv", "log"]);

export function extensionOf(name: string) {
  return name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "";
}

export function isSupportedDocument(file: File) {
  const ext = extensionOf(file.name);
  if (["pdf", "doc", "docx", "txt", "text", "md", "csv", "rtf"].includes(ext)) return true;
  const type = file.type.toLowerCase();
  return (
    type === "application/pdf" ||
    type === "application/msword" ||
    type === "application/rtf" ||
    type === "text/rtf" ||
    type.startsWith("text/") ||
    type.includes("wordprocessingml")
  );
}

export function mimeForFile(file: File) {
  const ext = extensionOf(file.name);
  if (ext === "pdf" || file.type === "application/pdf") return "application/pdf";
  if (ext === "docx" || file.type.includes("wordprocessingml")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  if (ext === "doc" || file.type === "application/msword") return "application/msword";
  if (ext === "rtf") return "application/rtf";
  if (TEXT_EXT.has(ext) || file.type.startsWith("text/")) return "text/plain";
  return file.type || "application/octet-stream";
}

export async function extractDocumentText(file: File): Promise<string> {
  const ext = extensionOf(file.name);
  const type = file.type.toLowerCase();
  const data = await file.arrayBuffer();
  if (ext === "pdf" || type === "application/pdf") return extractPdfText(data);
  if (ext === "docx" || type.includes("wordprocessingml")) return extractDocx(data);
  if (ext === "doc" || type === "application/msword") return extractLegacyDoc(data);
  if (ext === "rtf" || type === "application/rtf" || type === "text/rtf") {
    return rtfToText(decodeText(data));
  }
  if (TEXT_EXT.has(ext) || type.startsWith("text/")) return decodeText(data);
  throw new Error("Use a PDF, Word document (.doc or .docx), or a text file.");
}

async function extractDocx(data: ArrayBuffer) {
  const mammoth = await import("mammoth/mammoth.browser.js");
  const result = await mammoth.extractRawText({ arrayBuffer: data });
  const text = String(result.value ?? "").trim();
  if (text.length < 20) throw new Error("This Word file had no readable text.");
  return text;
}

function extractLegacyDoc(data: ArrayBuffer) {
  const bytes = new Uint8Array(data);
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) return extractDocx(data);
  const parts = utf16Runs(bytes);
  const text = parts.join("\n").replace(/\s+\n/g, "\n").trim();
  if (text.length < 80) {
    throw new Error("This .doc file could not be read. Save it as .docx or PDF and upload that.");
  }
  return text;
}

function utf16Runs(bytes: Uint8Array) {
  const out: string[] = [];
  let current = "";
  const flush = () => {
    const text = current.replace(/[ \t]+\n/g, "\n").replace(/[ \t]{2,}/g, " ").trim();
    const letters = text.match(/[A-Za-z]/g)?.length ?? 0;
    if (text.length >= 24 && letters > 12 && letters / text.length > 0.4) out.push(text);
    current = "";
  };
  for (let i = 0; i + 1 < bytes.length; i += 2) {
    const code = bytes[i] | (bytes[i + 1] << 8);
    const ok =
      code === 9 ||
      code === 10 ||
      code === 13 ||
      (code >= 32 && code <= 126) ||
      (code >= 160 && code <= 591);
    if (!ok) {
      flush();
      continue;
    }
    current += code === 10 || code === 13 ? "\n" : String.fromCharCode(code);
    if (current.length > 5000) flush();
  }
  flush();
  return out;
}

function rtfToText(raw: string) {
  return raw
    .replace(/\\par[d]?/g, "\n")
    .replace(/\\'[0-9a-fA-F]{2}/g, (hex) => String.fromCharCode(parseInt(hex.slice(2), 16)))
    .replace(/\\[a-z]+-?\d* ?/gi, "")
    .replace(/[{}]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function decodeText(data: ArrayBuffer) {
  return new TextDecoder("utf-8", { fatal: false }).decode(data).replace(/^\uFEFF/, "").trim();
}
