import { createServerFn } from "@tanstack/react-start";

const EMBED_MODEL = "nomic-embed-text-v1_5";

function cosine(a: number[], b: number[]) {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const length = Math.min(a.length, b.length);
  for (let i = 0; i < length; i += 1) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (!na || !nb) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export const embedRank = createServerFn({ method: "POST" })
  .validator((input: { query?: string; passages?: string[] }) => ({
    query: String(input?.query ?? "").slice(0, 800).trim(),
    passages: (input?.passages ?? [])
      .map((passage) => String(passage ?? "").slice(0, 900).trim())
      .filter(Boolean)
      .slice(0, 16),
  }))
  .handler(async ({ data }) => {
    const apiKey = process.env.GROQ_API_KEY?.trim() || "";
    if (!apiKey || !data.query || !data.passages.length) return { ok: false as const, order: [] as number[] };
    const res = await fetch("https://api.groq.com/openai/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: EMBED_MODEL,
        input: [`search_query: ${data.query}`, ...data.passages.map((passage) => `search_document: ${passage}`)],
      }),
    });
    if (!res.ok) return { ok: false as const, order: [] as number[] };
    const body = (await res.json()) as { data?: { index?: number; embedding?: number[] }[] };
    const rows = [...(body.data ?? [])].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
    const query = rows[0]?.embedding ?? [];
    const order = rows
      .slice(1)
      .map((row, index) => ({ index, score: cosine(query, row.embedding ?? []) }))
      .sort((a, b) => b.score - a.score)
      .map((row) => row.index);
    return { ok: true as const, order };
  });
