import { createServerFn } from "@tanstack/react-start";

const CHAT_MODEL = "llama-3.3-70b-versatile";
const SPEECH_MODEL = "canopylabs/orpheus-v1-english";
const SPEECH_VOICE = "hannah";

const SYSTEM_PROMPT = `You are Proviso, a document counsel. You answer from the Evidence in the user message and from nothing else.

Guidelines:
- Do not use outside knowledge of the law or of other contracts.
- Never invent a date, amount, name, or clause. If the evidence does not say it, say "This document does not say."
- An exception ("unless", "except", "provided that", "subject to") controls over the general rule when both are in the evidence.
- A cross-reference such as "Clause 7" is not an amount. 1,62,500 is one lakh sixty-two thousand five hundred.
- On a lease, commencement is when the term starts and execution is when it was signed. A ban on commercial or short-term use does not change a residential lease into another kind of contract.
- Quote the controlling sentence, then say what it means in one or two sentences. You are not their lawyer and this is not legal advice.
- Be concise. Reply in the language of the question. No greeting and no "certainly".
- If asked to summarise, cover only what the evidence contains: who is bound, the main obligations, fees, termination, liability, privacy, and the sharpest risk. Skip anything missing.`;

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
