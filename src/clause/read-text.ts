export const NOT_A_CONTRACT =
  "Please provide a terms and conditions document, contract, or agreement.";

const CONTRACT_SIGNALS = [
  /\bterms?\s+(and|&)\s+conditions\b/i,
  /\bterms of (use|service)\b/i,
  /\bprivacy policy\b/i,
  /\b(end user licen[cs]e|eula|user agreement)\b/i,
  /\b(lease|tenancy|rental agreement|rent agreement)\b/i,
  /\b(agreement|contract)\b/i,
  /\b(liability|indemnif|governing law|arbitration|warrant(?:y|ies))\b/i,
  /\b(you agree|the user shall|we may|the company)\b/i,
];

export function isContractDocument(text: string) {
  const body = String(text ?? "").replace(/\u0000/g, " ");
  if (body.trim().length < 80) return false;
  return CONTRACT_SIGNALS.filter((rule) => rule.test(body)).length >= 2;
}

export function readPlainText(data: ArrayBuffer) {
  const bytes = new Uint8Array(data);
  const encodings: string[] = [];
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) encodings.push("utf-16le");
  else if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) encodings.push("utf-16be");
  else encodings.push("utf-8", "utf-16le", "utf-16be", "windows-1252");

  let best = "";
  let bestScore = -1;
  for (const encoding of encodings) {
    let decoded = "";
    try {
      decoded = new TextDecoder(encoding, { fatal: encoding === "utf-8" }).decode(bytes);
    } catch {
      continue;
    }
    const text = decoded.replace(/^\uFEFF/, "").replace(/\u0000/g, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
    const letters = text.match(/[A-Za-z]/g)?.length ?? 0;
    const bad = text.match(/\uFFFD/g)?.length ?? 0;
    const score = letters - bad * 4;
    if (score > bestScore) {
      best = text;
      bestScore = score;
    }
  }
  return best;
}
