import { createServerFn } from "@tanstack/react-start";
import { linearRetrieve } from "@/clause/linearrag";

const MODEL = "llama-3.3-70b-versatile";
const MAX_STEPS = 4;

const INSTRUCTIONS = `You are Proviso, the counsel agent for one contract or terms document.

How you work:
- Use only this document. Do not use outside knowledge of the law or of other contracts.
- Call search_passages before you state a fact. If the passages are not enough, call it again with the defined term, the clause number, or a narrower question.
- Call list_risks when the user asks what is risky, unfair, or one-sided.
- Stop calling tools once you can answer. Then reply in plain text.
- Never invent a date, amount, name, or clause. If the tool results do not say it, say "This document does not say."
- An exception ("unless", "except", "provided that", "subject to") controls over the general rule when both are in the results.
- A cross-reference such as "Clause 7" is not an amount. Indian grouping 1,62,500 means one lakh sixty-two thousand five hundred.
- Quote the controlling sentence, then say what it means. You are not their lawyer and this is not legal advice.
- Reply in the language of the question. No greeting and no "certainly".`;

const TOOLS = [
  {
    type: "function",
    function: {
      name: "search_passages",
      description: "Find the passages in this document that bear on a question. Call this before answering.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "The fact, clause, or defined term to look up." },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_risks",
      description: "List risks already flagged on this document.",
      parameters: { type: "object", properties: {} },
    },
  },
];

type ToolCall = { id?: string; function?: { name?: string; arguments?: string } };
type AgentMessage = {
  role: string;
  content?: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
};

function clip(value: unknown, max: number) {
  return String(value ?? "").slice(0, max);
}

function runTool(name: string, args: { query?: string }, sourceText: string, risks: string) {
  if (name === "search_passages") {
    const found = linearRetrieve(sourceText, String(args.query || ""), 6);
    return found || "No passage matched that query.";
  }
  if (name === "list_risks") return risks || "No risks were flagged.";
  return "That tool is not available.";
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
    const apiKey = process.env.GROQ_API_KEY?.trim() || "";
    if (!data.question) return { ok: false as const, error: "Empty question." };
    if (!apiKey) return { ok: false as const, error: "AI is unavailable." };

    const messages: AgentMessage[] = [
      {
        role: "system",
        content: `${INSTRUCTIONS}\n\nDocument: ${data.title}\n${data.facts}`,
      },
      { role: "user", content: data.question },
    ];

    for (let step = 0; step < MAX_STEPS; step += 1) {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: MODEL,
          temperature: 0,
          max_tokens: 600,
          tools: TOOLS,
          tool_choice: step === MAX_STEPS - 1 ? "none" : "auto",
          messages,
        }),
      });
      if (!res.ok) return { ok: false as const, error: `AI error ${res.status}` };
      const body = (await res.json()) as { choices?: { message?: AgentMessage }[] };
      const message = body.choices?.[0]?.message;
      if (!message) return { ok: false as const, error: "Empty answer." };
      const calls = message.tool_calls ?? [];
      if (!calls.length) {
        const text = String(message.content ?? "").trim();
        if (!text) return { ok: false as const, error: "Empty answer." };
        return { ok: true as const, text, steps: step + 1 };
      }
      messages.push({ role: "assistant", content: message.content ?? "", tool_calls: calls });
      for (const call of calls) {
        let args: { query?: string } = {};
        try {
          args = JSON.parse(call.function?.arguments || "{}") as { query?: string };
        } catch {
          args = {};
        }
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: runTool(call.function?.name || "", args, data.sourceText, data.risks).slice(0, 7000),
        });
      }
    }
    return { ok: false as const, error: "The agent stopped before it answered." };
  });
