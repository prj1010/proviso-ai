import { createServerFn } from "@tanstack/react-start";

function clip(value: unknown, max: number) {
  return String(value ?? "").slice(0, max);
}

export const runCounselAgent = createServerFn({ method: "POST" })
  .validator((input: { question?: string; title?: string; sourceText?: string; facts?: string; risks?: string }) => ({
    question: clip(input?.question, 800).trim(),
    title: clip(input?.title, 180) || "Document",
    sourceText: clip(input?.sourceText, 80000),
    facts: clip(input?.facts, 2000),
    risks: clip(input?.risks, 2500),
  }))
  .handler(async ({ data }) => {
    if (!data.question) return { ok: false as const, error: "Empty question." };
    if (!process.env.GROQ_API_KEY?.trim()) return { ok: false as const, error: "AI is unavailable." };
    try {
      const { runMastraCounsel } = await import("@/clause/mastra-counsel");
      return await runMastraCounsel({ ...data, queries: [], sequential: "" });
    } catch (err) {
      return { ok: false as const, error: err instanceof Error ? err.message : "The agent stopped before it answered." };
    }
  });
