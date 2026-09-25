import { Agent } from "@mastra/core/agent";
import { RequestContext } from "@mastra/core/request-context";
import { createTool } from "@mastra/core/tools";
import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import { linearRetrieve } from "@/clause/linearrag";

const MODEL = "openai/gpt-oss-20b";

const INSTRUCTIONS = `You are Proviso, a document counsel operating inside a Mastra harness. You help the user understand one contract or set of terms by searching its passages and reading the risks already flagged on it.

Available tools:
- search_passages: Retrieve the passages that bear on one query. The query should be a fact, a defined term, or a clause number.
- list_risks: Return the risks already flagged on this document. It does not search the text.

Guidelines:
- Use search_passages before you state a fact from the document. Do not answer from memory of other contracts or of the law.
- Use list_risks only when the user asks what is risky, unfair, one-sided, or what to watch.
- Independent lookups run in parallel. If the question has more than one part, call search_passages once per part in the same turn.
- A lookup that depends on an earlier result runs only after that result is back. Do not guess the next query.
- If the first passages are not enough, call search_passages again with the defined term or the clause number. Do not repeat the same query.
- Never invent a date, amount, name, or clause. If the tool results do not say it, say "This document does not say."
- An exception ("unless", "except", "provided that", "subject to") controls over the general rule when both are in the results.
- A cross-reference such as "Clause 7" is not an amount. Read Indian digit groups as written: 1,62,500 is one lakh sixty-two thousand five hundred.
- On a lease, commencement is when the term starts and execution is when it was signed. A ban on commercial or short-term use does not change a residential lease into another kind of contract.
- Quote the controlling sentence, then say what it means in one or two sentences. You are not their lawyer and this is not legal advice. Do not tell them to sign or to walk away.
- Be concise. Reply in the language of the question. No greeting and no "certainly".

When the user asks for a summary, cover only what the results contain: who is bound, the main obligations, fees, termination, liability, privacy, and the sharpest flagged risk. Skip any item that was not found.`;

const packet = z.object({
  question: z.string(),
  title: z.string(),
  facts: z.string(),
  sourceText: z.string(),
  risks: z.string(),
  queries: z.array(z.string()),
  sequential: z.string(),
});

const finding = z.object({
  query: z.string(),
  finding: z.string(),
});

type Packet = z.infer<typeof packet>;

export function planQuestion(question: string) {
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
  if (parallel.length < 2) parallel = [sequential ? head : question];
  return { parallel: parallel.slice(0, 4), sequential };
}

function searchTool() {
  return createTool({
    id: "search_passages",
    description: "Retrieve the passages that bear on one query. Pass a fact, a defined term, or a clause number. Call once per independent part in the same turn.",
    inputSchema: z.object({ query: z.string() }),
    outputSchema: z.object({ passages: z.string() }),
    execute: async ({ query }, context) => {
      const source = String(context.requestContext.get("sourceText") ?? "");
      const passages = linearRetrieve(source, query, 6) || "No passage matched that query.";
      return { passages: passages.slice(0, 7000) };
    },
  });
}

function riskTool() {
  return createTool({
    id: "list_risks",
    description: "Return risks already flagged on this document. Use only when the user asks what is risky, unfair, or one-sided. This does not search the text.",
    inputSchema: z.object({}),
    outputSchema: z.object({ risks: z.string() }),
    execute: async (_input, context) => ({
      risks: String(context.requestContext.get("risks") ?? "") || "No risks were flagged.",
    }),
  });
}

async function readPart(input: Packet, query: string) {
  if (!query) return { query: "", finding: "" };
  const passages = linearRetrieve(input.sourceText, query, 5) || "No passage matched.";
  const agent = new Agent({
    id: "proviso-part",
    name: "Proviso part reader",
    instructions: `${INSTRUCTIONS}\nAnswer only this one part. Quote the sentence you used.`,
    model: MODEL,
  });
  const response = await agent.generate(
    `Document: ${input.title}\n${input.facts}\n\nPart: ${query}\n\nPassages:\n${passages.slice(0, 5000)}`,
    { maxSteps: 1 },
  );
  return { query, finding: response.text?.trim() || "This document does not say." };
}

function counselWorkflow(count: number) {
  const lookups = Array.from({ length: count }, (_, index) =>
    createStep({
      id: `part-${index}`,
      inputSchema: packet,
      outputSchema: finding,
      execute: async ({ inputData }) => readPart(inputData, inputData.queries[index] || ""),
    }),
  );
  const combine = createStep({
    id: "answer",
    inputSchema: z.record(z.string(), finding),
    outputSchema: z.object({ text: z.string() }),
    execute: async ({ inputData, getInitData }) => {
      const start = getInitData() as Packet;
      const brief = Object.values(inputData)
        .filter((item) => item?.query)
        .map((item, index) => `Part ${index + 1} (${item.query}):\n${item.finding}`)
        .join("\n\n");
      const follow = start.sequential
        ? `Using only the findings below, do this next: ${start.sequential}`
        : `Using only the findings below, answer the original question: ${start.question}`;
      const agent = new Agent({
        id: "proviso-closer",
        name: "Proviso closer",
        instructions: INSTRUCTIONS,
        model: MODEL,
      });
      const response = await agent.generate(
        `Document: ${start.title}\n${start.facts}\n\n${follow}\n\n${brief}`,
        { maxSteps: 1 },
      );
      return { text: response.text?.trim() || "" };
    },
  });
  return createWorkflow({
    id: "proviso-counsel",
    inputSchema: packet,
    outputSchema: z.object({ text: z.string() }),
    options: { shouldPersistSnapshot: () => false },
  })
    .parallel(lookups)
    .then(combine)
    .commit();
}

async function runSequentialAgent(input: Packet) {
  const requestContext = new RequestContext();
  requestContext.set("sourceText", input.sourceText);
  requestContext.set("risks", input.risks);
  const agent = new Agent({
    id: "proviso-counsel",
    name: "Proviso counsel",
    instructions: INSTRUCTIONS,
    model: MODEL,
    tools: { search_passages: searchTool(), list_risks: riskTool() },
  });
  const response = await agent.generate(
    `Document: ${input.title}\n${input.facts}\n\nQuestion: ${input.question}`,
    { maxSteps: 4, requestContext },
  );
  return response.text?.trim() || "";
}

export async function runMastraCounsel(input: Packet) {
  const plan = planQuestion(input.question);
  const packetInput = { ...input, queries: plan.parallel, sequential: plan.sequential };
  if (plan.parallel.length === 1 && !plan.sequential) {
    const text = await runSequentialAgent(packetInput);
    if (!text) return { ok: false as const, error: "Empty answer." };
    return { ok: true as const, text, steps: 1, mode: "sequential" as const };
  }
  const workflow = counselWorkflow(plan.parallel.length);
  const run = await workflow.createRun({ shouldPersistSnapshot: () => false });
  const result = await run.start({ inputData: packetInput });
  if (result.status !== "success") {
    return { ok: false as const, error: "The agent stopped before it answered." };
  }
  const text = String(result.result?.text ?? "").trim();
  if (!text) return { ok: false as const, error: "Empty answer." };
  return { ok: true as const, text, steps: plan.parallel.length + 1, mode: "parallel-then-sequential" as const };
}
