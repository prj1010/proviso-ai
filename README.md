# Proviso

Read a contract or a set of terms before you accept it. Upload a PDF, Word, or text file and Proviso pulls the obligations, fees, and risky clauses. Ask a question and the answer cites the wording, including on long documents. Asha, the voice counsel, can brief the open document out loud.

Text files are decoded in the browser. If that text is thin, or the file is an older `.doc`, the server converts it with the JavaScript package `markitdown-js` (no Python). Document questions run through Mastra on Groq `llama-3.3-70b-versatile`. A single question uses a Mastra agent with search and risk tools. A compound question uses a Mastra workflow: the parts run with `.parallel()`, then one `.then()` step writes the answer.

Two sample agreements are already in the workspace, so you can click around before uploading anything.

## Run it

```bash
npm install
GROQ_API_KEY=your_groq_key FISH_API_KEY=your_fish_key npm run dev
```

Open [http://localhost:8080](http://localhost:8080). Sign in with any email. The code is **482910**.

## Speech

Asha speaks with Fish Audio when `FISH_API_KEY` is set. That is the natural voice path. If Fish is missing or fails, Groq Orpheus speaks. If both fail, the browser speaks.

| Use | Model |
| --- | --- |
| Lease answers | Groq `llama-3.3-70b-versatile` |
| Asha's voice (preferred) | Fish Audio `s2.1-pro-free`, warm conversational English |
| Asha's voice (fallback) | Groq `canopylabs/orpheus-v1-english` (voice `hannah`) |

Get a Fish key at [fish.audio](https://fish.audio). Optional: set `FISH_VOICE_ID` to any public model id from the Voice Library. Optional: set `FISH_TTS_MODEL` if you are on a paid Fish plan and want `s2.1-pro`.

Set `GROQ_API_KEY` in the environment. Without either key, the page still works: answers stay on the local reader, and speech falls back to the browser.

## Jev

Jev is optional and secondary. TypeSafe is not accepting new keys, so the product does not depend on it. The keyword reader flags clauses, and Groq writes. Fish or Groq speaks.

If you already have `TYPESAFE_API_KEY`, Jev can add a **JEV** badge on a clause the keyword reader missed, and it can point a weak answer at a section. It does not replace those flags, and it does not block chat or Asha.

## Render

[render.yaml](render.yaml) is a Render Blueprint.

1. In Render, choose **New → Blueprint** and select this repo.
2. Set `GROQ_API_KEY` when the dashboard asks for it. Set `FISH_API_KEY` for natural speech. `TYPESAFE_API_KEY` is optional and not required.
3. Deploy. Render is running `npm ci` with `NODE_ENV=production`, so Vite, Nitro, and `@vitejs/plugin-react` are production dependencies. The start command is `npm start`.

The Blueprint uses Render's free web service. It sleeps after 15 minutes with no traffic, and the next visit wakes it.

## What it does not do

It is not a lawyer. It reads the text you give it and quotes that text back. A scanned PDF with no selectable text will not extract.
