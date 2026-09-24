# Proviso

Read a lease before you sign it. Upload a PDF and Proviso pulls the rent, deposit, dates, and parties, then flags the risky clauses. Ask a question and the answer cites the wording. Asha, the voice counsel, can brief the open agreement out loud.

Two sample agreements are already in the workspace, so you can click around before uploading anything.

## Run it

```bash
npm install
GROQ_API_KEY=your_groq_key TYPESAFE_API_KEY=your_typesafe_key npm run dev
```

Open [http://localhost:8080](http://localhost:8080). Sign in with any email. The code is **482910**.

## Groq

Chat and speech both use your Groq key. Nothing is sent until you ask a question or press speak.

| Use | Model |
| --- | --- |
| Lease answers | `llama-3.3-70b-versatile` |
| Asha's voice | `canopylabs/orpheus-v1-english` (voice `hannah`) |

Set `GROQ_API_KEY` in the environment. Without it, the page still works: answers stay on the local reader, and speech falls back to the browser.

Straight questions about rent, notice, and the deposit are answered locally and do not call Groq. Groq is used when the local reader is unsure, or when the question is in Hinglish or another language.

## Jev

Typed decisions use TypeSafe Jev (`jev-latest`). Jev does not write the answer and does not speak. Set `TYPESAFE_API_KEY`.

| Decision | What it does |
| --- | --- |
| Clause type and tenant-risk score | One request per clause on upload |
| Trap checks | Indemnity, auto-renew, non-refundable deposit, one-sided lock-in |
| Citation | Picks the section that answers the question |
| Support gate | Blocks Asha when the line is not supported (below 0.6) |

With `TYPESAFE_API_KEY` set, judged clauses drop the keyword flag and keep only the Jev decision. A question is answered only when a section clears 0.55. Groq may phrase that section, and only if support is at least 0.6. Below that, or if Jev returns no typed answer, Asha does not read it. Without the key, the keyword reader still runs.

## Render

[render.yaml](render.yaml) is a Render Blueprint.

1. In Render, choose **New → Blueprint** and select this repo.
2. Set `GROQ_API_KEY` and `TYPESAFE_API_KEY` when the dashboard asks for them.
3. Deploy. The build is `npm ci && npm run build`. The start command is `npm start`.

Render sets `RENDER=true`. That switches the production server to Node and binds it to `PORT`. Agreements stay in the browser. No database is required.

## What it does not do

It is not a lawyer. It reads the text you give it and quotes that text back. A scanned PDF with no selectable text will not extract.
