export const NOT_A_LEASE = "Please provide appropriate rental/lease agreement";

const PARTY = /\b(landlord|lessor|tenant|lessee|licensor|licensee)\b/i;
const DEAL = /\b(lease agreement|rental agreement|tenancy agreement|leave and licen[cs]e|rent agreement)\b/i;
const MONEY = /\b(monthly rent|base rent|rent payable|security deposit|advance rent|rental)\b/i;
const PLACE = /\b(premises|demised|leased property|lock-?in|notice period)\b/i;

export function isRentalAgreement(text: string) {
  const body = String(text ?? "").replace(/\u0000/g, " ");
  if (body.trim().length < 40) return false;
  const hits = [PARTY, DEAL, MONEY, PLACE].filter((rule) => rule.test(body)).length;
  const namesAParty = PARTY.test(body);
  const namesADeal = DEAL.test(body) || MONEY.test(body) || PLACE.test(body);
  return hits >= 2 && namesAParty && namesADeal;
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
