# Proviso

Read a lease before you sign it. Upload a PDF, Word, or text file and Proviso pulls the rent, deposit, dates, and parties, then flags the risky clauses. Ask a question and the answer cites the wording. Asha, the voice counsel, can brief the open agreement out loud.

PDF and Word files are read in the browser. If that text is too thin, or the file is an older `.doc`, the server converts it with [MarkItDown](https://github.com/microsoft/markitdown) when Python is available. Plain text does not use it. On Render the build installs `markitdown[pdf,docx]` into `.python-packages` if `python3` is on the image.

Two sample agreements are already in the workspace, so you can click around before uploading anything.

## Run it

```bash
npm install
GROQ_API_KEY=your_groq_key npm run dev
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

Jev is optional and secondary. TypeSafe is not accepting new keys, so the product does not depend on it. The keyword reader flags clauses, and Groq writes and speaks.

If you already have `TYPESAFE_API_KEY`, Jev can add a **JEV** badge on a clause the keyword reader missed, and it can point a weak answer at a section. It does not replace those flags, and it does not block chat or Asha.

## Render

[render.yaml](render.yaml) is a Render Blueprint.

1. In Render, choose **New → Blueprint** and select this repo.
2. Set `GROQ_API_KEY` when the dashboard asks for it. `TYPESAFE_API_KEY` is optional and not required.
3. Deploy. Render is running `npm ci` with `NODE_ENV=production`, so Vite, Nitro, and `@vitejs/plugin-react` are production dependencies. The start command is `npm start`.

The Blueprint uses Render's free web service. It sleeps after 15 minutes with no traffic, and the next visit wakes it.

## What it does not do

It is not a lawyer. It reads the text you give it and quotes that text back. A scanned PDF with no selectable text will not extract.
