import { createServerFn } from "@tanstack/react-start";
import { linearRetrieve } from "@/clause/linearrag";

const MODEL = "llama-3.3-70b-versatile";
const MAX_STEPS = 4;

const INSTRUCTIONS = `You are Proviso, the counsel agent for one contract or terms document.

How you work:
- Use only this document. Do not use outside knowledge of the law or of other contracts.
- Call search_passages before you state a fact. If the passages are not enough, call it again with the defined term, the clause number, or a narrower question.
- Call list_risks when the user asks what is risky, unfair, or one-sided.
- Independent questions in one turn run together. Call every search you need in the same step.
- A later step may use those results. Do that only when the next lookup depends on the earlier one.
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

function planQuestion(question: string) {
  const stages = question
    .split(/\s+then\s+/i)
    .map((part) => part.trim())
    .filter(Boolean);
  const head = stages[0] || question;
  const sequential = stages.slice(1).join(" ").trim();
  let parallel = head
    .split(/\s*;\s*|\s+\balso\b\s+/i)
    .map((part) => part.trim())
    .filter((part) => part.length > 8);
  if (parallel.length < 2 && /\band\b/i.test(head)) {
    const sides = head.split(/\s+\band\b\s+/i).map((part) => part.trim()).filter(Boolean);
    const looksLikeTask = (part: string) =>
      part.length > 10 && /\b(what|who|when|where|how|which|is|does|can|summar|list|find|show)\b/i.test(part);
    if (sides.length > 1 && sides.length <= 4 && looksLikeTask(sides[0]) && sides.every((part) => part.length > 10)) {
      parallel = sides;
    }
  }
  if (parallel.length < 2) parallel = [question];
  return { parallel: parallel.slice(0, 4), sequential };
}

async function groqChat(
  apiKey: string,
  messages: AgentMessage[],
  options: { tools?: boolean; forceAnswer?: boolean },
) {
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
      messages,
      ...(options.tools
        ? { tools: TOOLS, tool_choice: options.forceAnswer ? "none" : "auto" }
        : {}),
    }),
  });
  if (!res.ok) throw new Error(`AI error ${res.status}`);
  const body = (await res.json()) as { choices?: { message?: AgentMessage }[] };
  return body.choices?.[0]?.message ?? null;
}

async function parallelFinding(
  apiKey: string,
  title: string,
  facts: string,
  sourceText: string,
  query: string,
) {
  const passages = linearRetrieve(sourceText, query, 5) || "No passage matched.";
  const message = await groqChat(
    apiKey,
    [
      {
        role: "system",
        content: `${INSTRUCTIONS}\n\nDocument: ${title}\n${facts}\nAnswer only this one part. Quote the sentence you used.`,
      },
      { role: "user", content: `Part: ${query}\n\nPassages:\n${passages.slice(0, 5000)}` },
    ],
    {},
  );
  return String(message?.content ?? "").trim() || "This document does not say.";
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

    const plan = planQuestion(data.question);
    if (plan.parallel.length > 1 || plan.sequential) {
      try {
        const findings = await Promise.all(
          plan.parallel.map((query) => parallelFinding(apiKey, data.title, data.facts, data.sourceText, query)),
        );
        const brief = findings.map((finding, index) => `Part ${index + 1} (${plan.parallel[index]}):\n${finding}`).join("\n\n");
        const follow = plan.sequential
          ? `Using only the findings below, do this next: ${plan.sequential}`
          : `Using only the findings below, answer the original question: ${data.question}`;
        const closer = await groqChat(
          apiKey,
          [
            { role: "system", content: `${INSTRUCTIONS}\n\nDocument: ${data.title}\n${data.facts}` },
            { role: "user", content: `${follow}\n\n${brief}` },
          ],
          {},
        );
        const text = String(closer?.content ?? "").trim();
        if (text) return { ok: true as const, text, steps: plan.parallel.length + 1, mode: "parallel-then-sequential" as const };
      } catch {
        /* sequential loop stands */
      }
    }

    const messages: AgentMessage[] = [
      {
        role: "system",
        content: `${INSTRUCTIONS}\n\nDocument: ${data.title}\n${data.facts}`,
      },
      { role: "user", content: data.question },
    ];

    for (let step = 0; step < MAX_STEPS; step += 1) {
      let resMessage: AgentMessage | null = null;
      try {
        resMessage = await groqChat(apiKey, messages, {
          tools: true,
          forceAnswer: step === MAX_STEPS - 1,
        });
      } catch (err) {
        return { ok: false as const, error: err instanceof Error ? err.message : "AI error" };
      }
      if (!resMessage) return { ok: false as const, error: "Empty answer." };
      const calls = resMessage.tool_calls ?? [];
      if (!calls.length) {
        const text = String(resMessage.content ?? "").trim();
        if (!text) return { ok: false as const, error: "Empty answer." };
        return { ok: true as const, text, steps: step + 1, mode: "sequential" as const };
      }
      messages.push({ role: "assistant", content: resMessage.content ?? "", tool_calls: calls });
      const outputs = await Promise.all(
        calls.map(async (call) => {
          let args: { query?: string } = {};
          try {
            args = JSON.parse(call.function?.arguments || "{}") as { query?: string };
          } catch {
            args = {};
          }
          return {
            role: "tool",
            tool_call_id: call.id,
            content: runTool(call.function?.name || "", args, data.sourceText, data.risks).slice(0, 7000),
          };
        }),
      );
      messages.push(...outputs);
    }
    return { ok: false as const, error: "The agent stopped before it answered." };
  });
