# qwen-ts-web

Browser-based Qwen chat client built with Vite, React, and TypeScript. It talks to a local Ollama server and streams responses from a selected Qwen model into a simple chat UI.

## What it does

- Runs a React web app at `http://localhost:3000`.
- Sends chat messages to Ollama's local `/api/chat` endpoint.
- Streams Ollama's newline-delimited JSON response into the assistant message as it arrives.
- Lets you choose between `qwen2.5:7b`, `qwen2.5:14b`, and `qwen2.5:3b`.
- Provides a Clear button to reset the current in-browser chat session.

## How it works

The main UI is in `src\App.tsx`. It stores the input text and selected model, renders chat messages, and calls `sendMessage` when the user submits a prompt.

The Ollama integration is in `src\hooks\useOllamaChat.ts`. The hook:

1. Keeps the message history in React state and a ref so streamed updates use the latest chat context.
2. Sends `POST http://localhost:11434/api/chat` with `{ model, messages, stream: true }`.
3. Reads the response stream with `ReadableStreamDefaultReader`.
4. Parses each newline-delimited JSON chunk from Ollama.
5. Appends `chunk.message.content` to the current assistant response.
6. Uses `AbortController` to cancel in-flight requests when needed.

## Prerequisites on Windows

Install these before running the app:

- Node.js 24 or newer.
- npm, included with Node.js.
- Ollama for Windows.
- At least one Qwen model pulled into Ollama.

Example PowerShell setup:

```powershell
winget install OpenJS.NodeJS
winget install Ollama.Ollama
ollama pull qwen2.5:7b
```

If you want the larger or smaller models shown in the app:

```powershell
ollama pull qwen2.5:14b
ollama pull qwen2.5:3b
```

## Install dependencies

From the repository root:

```powershell
Set-Location .\src\qwen-ts-web
npm install
```

## Run locally

Start Ollama first:

```powershell
ollama serve
```

In another PowerShell window, start the web app:

```powershell
Set-Location .\src\qwen-ts-web
npm run dev
```

Open:

```text
http://localhost:3000
```

If the browser reports a CORS error when calling Ollama, restart Ollama with an explicit allowed origin:

```powershell
$env:OLLAMA_ORIGINS = "http://localhost:3000"
ollama serve
```

## Available scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Starts the Vite development server on port `3000`. |
| `npm run build` | Type-checks and builds the production app into `dist`. |
| `npm run lint` | Runs ESLint over the project. |
| `npm run preview` | Serves the production build locally for preview. |

## Notes

- Ollama must be running on `http://localhost:11434`.
- The selected model must already exist locally in Ollama.
- Chat history is only held in React state and is lost on refresh.
- This app uses the same chat UI and Ollama hook as `..\qwen-ts-desktop`.
