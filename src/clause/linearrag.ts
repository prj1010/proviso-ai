import nlp from "compromise";

const STOP = new Set([
  "this", "that", "with", "from", "your", "have", "will", "shall", "such", "into", "about",
  "their", "there", "which", "what", "when", "where", "does", "been", "were", "they", "them",
  "also", "only", "than", "then", "under", "over", "each", "other", "agreement", "section",
  "clause", "party", "parties", "including", "without", "pursuant", "herein", "thereof",
]);

const CUES = [
  "liability", "indemnity", "indemnify", "warranty", "arbitration", "termination", "terminate",
  "refund", "cancellation", "privacy", "personal data", "governing law", "jurisdiction",
  "limitation", "damages", "intellectual property", "license", "subscription", "auto-renew",
  "automatic renewal", "fee", "fees", "payment", "deposit", "notice", "confidential",
  "data retention", "cookies", "account", "suspension", "force majeure", "severability",
  "assignment", "subcontract", "warranty disclaimer", "consequential", "class action",
];

export function chunkDocument(text: string) {
  const blocks = text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}|\n(?=\s*(?:#{1,6}\s+|\d+(?:\.\d+){0,3}[\.\)]\s+[A-Z]))/);
  const passages: string[] = [];
  for (const block of blocks) {
    const trimmed = block.replace(/[ \t]+\n/g, "\n").trim();
    if (trimmed.length < 40) continue;
    if (trimmed.length <= 1100) {
      passages.push(trimmed);
      continue;
    }
    const sentences = trimmed.split(/(?<=[.;])\s+/);
    let current = "";
    for (const sentence of sentences) {
      if ((current + " " + sentence).length > 900 && current.length > 40) {
        passages.push(current.trim());
        current = sentence;
      } else {
        current = current ? `${current} ${sentence}` : sentence;
      }
    }
    if (current.trim().length > 40) passages.push(current.trim());
    if (passages.length >= 220) break;
  }
  return passages.slice(0, 220);
}

function addEntity(found: Set<string>, phrase: string) {
  const key = phrase
    .replace(/^the\s+/i, "")
    .replace(/[.,;:]+$/g, "")
    .trim()
    .toLowerCase();
  if (key.length > 3 && key.length < 60 && !STOP.has(key)) found.add(key);
}

function entitiesOf(text: string) {
  const found = new Set<string>();
  const lower = text.toLowerCase();
  for (const cue of CUES) if (lower.includes(cue)) found.add(cue);
  const defined = text.match(/\b([A-Z][A-Za-z]{2,})\s+means\b/g) ?? [];
  for (const item of defined) addEntity(found, item.replace(/\s+means$/i, ""));
  try {
    const doc = nlp(text);
    for (const list of [doc.people().out("array"), doc.places().out("array"), doc.organizations().out("array"), doc.nouns().out("array")]) {
      for (const phrase of list as string[]) addEntity(found, phrase);
    }
  } catch {
    const phrases = text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3}\b/g) ?? [];
    for (const phrase of phrases) addEntity(found, phrase);
  }
  return [...found];
}

export function linearCandidates(text: string, question: string, limit = 16) {
  const ranked = scorePassages(text, question);
  return ranked.slice(0, limit).map((item) => item.passage);
}

export function linearRetrieve(text: string, question: string, limit = 8) {
  const ranked = scorePassages(text, question).slice(0, limit).sort((a, b) => a.index - b.index);
  if (!ranked.length) return String(text ?? "").slice(0, 6000);
  let packed = "";
  for (const item of ranked) {
    if (packed.length + item.passage.length > 9000) break;
    packed += `${packed ? "\n\n" : ""}${item.passage}`;
  }
  return packed || ranked[0].passage;
}

function scorePassages(text: string, question: string) {
  const passages = chunkDocument(text);
  if (!passages.length) return [] as { score: number; index: number; passage: string }[];
  const links = new Map<string, number[]>();
  const passageEntities = passages.map((passage, index) => {
    const entities = entitiesOf(passage);
    for (const entity of entities) {
      const list = links.get(entity) ?? [];
      list.push(index);
      links.set(entity, list);
    }
    return entities;
  });
  for (const [entity, indexes] of links) {
    if (indexes.length > 28) links.delete(entity);
  }

  const queryEntities = new Set(entitiesOf(question));
  const scores = passages.map(() => 0);
  const seeds: number[] = [];
  for (const entity of queryEntities) {
    for (const index of links.get(entity) ?? []) {
      scores[index] += 1;
      if (!seeds.includes(index)) seeds.push(index);
    }
  }
  for (const seed of seeds) {
    for (const entity of passageEntities[seed]) {
      for (const other of links.get(entity) ?? []) {
        if (other !== seed) scores[other] += 0.4;
      }
    }
    if (seed > 0) scores[seed - 1] += 0.25;
    if (seed + 1 < scores.length) scores[seed + 1] += 0.25;
  }

  const picked = scores
    .map((score, index) => ({ score, index, passage: passages[index] }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);
  if (picked.length) return picked;
  return passages.slice(0, 4).map((passage, index) => ({ score: 0, index, passage }));
}
