import { createServerFn } from "@tanstack/react-start";

const CHAT_MODEL = "llama-3.3-70b-versatile";
const SPEECH_MODEL = "canopylabs/orpheus-v1-english";
const SPEECH_VOICE = "hannah";

const SYSTEM_PROMPT = `You are Proviso. You answer questions about one contract or terms document, and only that document.

Rules you do not break:
1. Use only the Evidence. Do not recall other documents, typical market terms, or the law beyond what the evidence states.
2. Never invent a date, amount, name, definition, or clause. If the evidence does not state it, say "This document does not say." and stop that point.
3. Read Indian digit groups correctly. 1,62,500 is one lakh sixty-two thousand five hundred. A cross-reference such as "Clause 7" is not an amount.
4. A defined term means what its definition says. If a passage says "unless", "except", "provided that", or "subject to", that exception controls over the general rule.
5. Prefer the operative clause over a table of contents, a heading, or a proposed addendum. Follow a cross-reference only when the target wording is also in the evidence.
6. On a lease, commencement is when the term starts and execution is when it was signed. A ban on commercial or short-term use does not change a residential lease into another kind of contract.
7. Give the answer in one or two plain sentences, then quote the controlling sentence. Name the section heading when the evidence has one.
8. If a flagged risk matches the question, add the level and what it means for the person bound by the document. Do not warn about a clause that is not in the evidence.
9. You are not their lawyer. This is not legal advice. Do not tell them to accept or reject the terms. You may say a term is one-sided.
10. Reply in the language of the question, including Hinglish. No greeting, no "certainly", and do not repeat the question.
11. If asked to summarise, cover parties or the company and the user, the main obligations, fees, termination, liability, privacy, and the sharpest risk. Skip any item the evidence does not contain.`;

function clip(value: unknown, max: number) {
  return String(value ?? "").slice(0, max);
}

function groqKey() {
  return process.env.GROQ_API_KEY?.trim() || "";
}

export const speakClause = createServerFn({ method: "POST" })
  .validator((input: { text?: string }) => ({
    text: clip(input?.text, 900).trim(),
  }))
  .handler(async ({ data }) => {
    if (!data.text) return { ok: false as const, error: "Nothing to say." };
    const apiKey = groqKey();
    if (!apiKey) return { ok: false as const, error: "Voice is unavailable." };

    const res = await fetch("https://api.groq.com/openai/v1/audio/speech", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: SPEECH_MODEL,
        voice: SPEECH_VOICE,
        input: data.text,
        response_format: "wav",
      }),
    });

    if (!res.ok) {
      return { ok: false as const, error: `Voice is unavailable (${res.status}).` };
    }

    const bytes = Buffer.from(await res.arrayBuffer());
    if (!bytes.byteLength) return { ok: false as const, error: "Voice returned no audio." };
    return { ok: true as const, audioBase64: bytes.toString("base64"), mime: "audio/wav" };
  });

export const counselAnswer = createServerFn({ method: "POST" })
  .validator((input: { question?: string; evidence?: string; title?: string }) => ({
    question: clip(input?.question, 800).trim(),
    evidence: clip(input?.evidence, 14000),
    title: clip(input?.title, 180) || "Agreement",
  }))
  .handler(async ({ data }) => {
    if (!data.question) return { ok: false as const, error: "Empty question." };
    const apiKey = groqKey();
    if (!apiKey) return { ok: false as const, error: "AI is unavailable." };

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: CHAT_MODEL,
        max_tokens: 500,
        temperature: 0,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `Agreement: ${data.title}\n\nEvidence:\n${data.evidence}\n\nQuestion: ${data.question}`,
          },
        ],
      }),
    });

    if (!res.ok) {
      return { ok: false as const, error: `AI error ${res.status}` };
    }
    const body = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = body.choices?.[0]?.message?.content?.trim() ?? "";
    if (!text) return { ok: false as const, error: "Empty answer." };
    return { ok: true as const, text };
  });
