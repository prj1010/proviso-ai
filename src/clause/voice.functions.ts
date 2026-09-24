import { createServerFn } from "@tanstack/react-start";

const MODEL = "grok-4.5";

function clip(value: unknown, max: number) {
  return String(value ?? "").slice(0, max);
}

export const speakClause = createServerFn({ method: "POST" })
  .validator((input: { text?: string }) => ({
    text: clip(input?.text, 900).trim(),
  }))
  .handler(async ({ data }) => {
    if (!data.text) return { ok: false as const, error: "Nothing to say." };
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) return { ok: false as const, error: "Voice is unavailable." };

    const res = await fetch("https://api.x.ai/v1/tts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        text: data.text,
        voice_id: "eve",
        language: "en",
      }),
    });

    if (!res.ok) {
      return { ok: false as const, error: `Voice is unavailable (${res.status}).` };
    }

    const ctype = res.headers.get("content-type") || "";
    if (ctype.includes("application/json")) {
      const body = (await res.json()) as { url?: string; audio?: string };
      if (body.url) return { ok: true as const, url: body.url };
      return { ok: false as const, error: "Voice returned no audio." };
    }

    const bytes = Buffer.from(await res.arrayBuffer());
    const mime = ctype.includes("wav")
      ? "audio/wav"
      : ctype.includes("ogg")
        ? "audio/ogg"
        : "audio/mpeg";
    return { ok: true as const, audioBase64: bytes.toString("base64"), mime };
  });

export const counselAnswer = createServerFn({ method: "POST" })
  .validator((input: { question?: string; evidence?: string; title?: string }) => ({
    question: clip(input?.question, 800).trim(),
    evidence: clip(input?.evidence, 7000),
    title: clip(input?.title, 180) || "Agreement",
  }))
  .handler(async ({ data }) => {
    if (!data.question) return { ok: false as const, error: "Empty question." };
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) return { ok: false as const, error: "AI is unavailable." };

    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 420,
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content:
              "You are Proviso, a polite assistant scoped only to the user's lease. Answer only from the evidence. Quote the clause when wording matters. If the evidence does not address the question, say so. Do not give independent legal advice. If the user writes in Hinglish or another language, reply in that language. Keep it to a short paragraph or a few hyphen bullets.",
          },
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
