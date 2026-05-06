# qwen-rag-web

Browser-based RAG sample built with Vite, React, TypeScript, Ollama, and a local Qwen chat model.

The sample demonstrates the core RAG loop:

```text
user question -> retrieve relevant local chunks -> build prompt with context -> call Qwen through Ollama -> stream cited answer
```

It intentionally keeps retrieval simple and visible. Instead of a vector database, it uses a small mock knowledge base in TypeScript and keyword scoring in the browser. That makes the moving parts easy to inspect before replacing the retrieval layer with embeddings, Chroma, Qdrant, SQLite vector search, or another real RAG store.

## What this sample contains

| File | Purpose |
| --- | --- |
| `src\App.tsx` | UI for asking questions, choosing a Qwen model, viewing retrieved chunks, and seeing the final prompt. |
| `src\rag\knowledgeBase.ts` | Mock Acme support docs represented as local chunks. |
| `src\rag\retrieval.ts` | Small keyword retriever that scores chunks against the user question. |
| `src\ollama\chat.ts` | Builds the RAG prompt and streams `POST /api/chat` responses from Ollama. |
| `vite.config.ts` | Runs the app on `http://localhost:3001`. |

## Required software on Windows

Install:

1. Windows 10 or Windows 11.
2. PowerShell 7 or Windows PowerShell.
3. Node.js and npm.
4. Ollama for Windows.
5. At least one Qwen model installed in Ollama.

Example:

```powershell
winget install OpenJS.NodeJS
winget install Ollama.Ollama
```

Open a new PowerShell window and check:

```powershell
node --version
npm --version
ollama --version
```

## Install a Qwen model

The app defaults to:

```text
qwen2.5:7b
```

Pull it locally:

```powershell
ollama pull qwen2.5:7b
```

Optional models shown in the dropdown:

```powershell
ollama pull qwen2.5:3b
ollama pull qwen2.5:14b
```

List installed models:

```powershell
ollama list
```

Use the exact `name:tag` value from `ollama list` when adding models to the app. For example, `qwen2.5:7b` and `qwen2.5:14b` are different model tags.

## Start Ollama

Ollama usually runs automatically after installing Ollama for Windows. Its local API is:

```text
http://localhost:11434
```

If it is not running:

```powershell
ollama serve
```

Check the local API:

```powershell
curl http://localhost:11434/api/tags
```

You should see JSON with a `models` array.

## Configure CORS for the browser

This app runs at:

```text
http://localhost:3001
```

The browser calls Ollama at:

```text
http://localhost:11434
```

If the browser shows a CORS error, restart Ollama with the Vite origin allowed:

```powershell
$env:OLLAMA_ORIGINS = "http://localhost:3001"
ollama serve
```

For a persistent user-level setting:

```powershell
[Environment]::SetEnvironmentVariable("OLLAMA_ORIGINS", "http://localhost:3001", "User")
```

Restart Ollama after setting a persistent environment variable.

If you use `npm run preview`, Vite may serve on `http://localhost:4173`, so allow both origins:

```powershell
$env:OLLAMA_ORIGINS = "http://localhost:3001,http://localhost:4173"
ollama serve
```

## Run the sample

From the repository root:

```powershell
Set-Location .\src\qwen-rag-web
npm install
npm run dev
```

Open:

```text
http://localhost:3001
```

## Try these questions

The UI includes these examples:

```text
How do I run the Acme Support Portal locally?
What changed in release 4.2?
How does ticket search pagination work?
What should be escalated as a critical incident?
What do I do if the browser cannot call Ollama from Vite?
```

Each question should retrieve different mock chunks and produce an answer with citations such as `[handbook-setup]` or `[api-search]`.

## How retrieval works

The mock knowledge base is in:

```text
src\rag\knowledgeBase.ts
```

Each record is already a chunk:

```ts
{
  id: 'api-search',
  title: 'Acme API: Ticket search',
  source: 'mock-docs\\api-reference.md',
  content: 'Ticket search uses POST /api/search/tickets ...'
}
```

The retriever is in:

```text
src\rag\retrieval.ts
```

It:

1. Tokenizes the user question.
2. Tokenizes each chunk's title, source, and content.
3. Scores exact token matches higher than partial matches.
4. Sorts chunks by score.
5. Returns the top `N` chunks selected in the UI.

This is not production-quality semantic retrieval. It is a deliberately small retriever so you can see where the "R" in RAG happens.

## How the RAG prompt is built

The prompt builder is in:

```text
src\ollama\chat.ts
```

It creates two messages:

```json
[
  {
    "role": "system",
    "content": "You are a RAG demo assistant. Answer only from the provided context..."
  },
  {
    "role": "user",
    "content": "Context 1 [api-search]\nTitle: ...\nSource: ...\nContent: ...\n\nQuestion: ...\n\nAnswer with concise citations."
  }
]
```

The app sends those messages to Ollama:

```text
POST http://localhost:11434/api/chat
```

With this JSON shape:

```json
{
  "model": "qwen2.5:7b",
  "messages": [
    {
      "role": "system",
      "content": "You are a RAG demo assistant. Answer only from the provided context..."
    },
    {
      "role": "user",
      "content": "Context 1 [api-search]..."
    }
  ],
  "stream": true,
  "options": {
    "temperature": 0.2
  }
}
```

The app displays both the raw retrieved context and the final prompt so you can see exactly what is sent on each request.

## How streaming works

The request uses:

```json
{
  "stream": true
}
```

Ollama returns newline-delimited JSON. A typical chunk looks like:

```json
{
  "model": "qwen2.5:7b",
  "message": {
    "role": "assistant",
    "content": "Ticket"
  },
  "done": false
}
```

The app reads each line, parses the JSON, and appends `message.content` to the answer.

## How this differs from plain chat

Plain chat usually sends:

```text
system prompt + chat history + latest user message
```

This RAG sample sends:

```text
system prompt + retrieved document chunks + latest user message
```

The model still does not remember anything between requests. The app provides the relevant context every time.

## How to make it more realistic

Possible next steps:

1. Replace `knowledgeBase.ts` with markdown files loaded from an API.
2. Split larger documents into chunks during an indexing step.
3. Generate embeddings with an Ollama embedding model such as `nomic-embed-text`.
4. Store vectors in Chroma, Qdrant, LanceDB, or SQLite with a vector extension.
5. Retrieve by vector similarity instead of keyword overlap.
6. Add citation validation so answers can only cite chunks that were actually retrieved.
7. Keep chat history and include recent turns along with retrieved context.

## Available scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Starts the Vite development server on port `3001`. |
| `npm run build` | Type-checks and builds the production app into `dist`. |
| `npm run lint` | Runs ESLint over the project. |
| `npm run preview` | Serves the production build locally for preview. |

## Troubleshooting

| Problem | What to check |
| --- | --- |
| `Ollama API error: 404` or model not found | Run `ollama list` and choose an installed model tag. |
| Browser CORS error | Set `OLLAMA_ORIGINS` to include `http://localhost:3001` and restart Ollama. |
| No retrieved chunks | Ask about terms present in the mock docs, or inspect `src\rag\knowledgeBase.ts`. |
| Slow first response | Ollama may be loading the model into memory. |
| Out-of-memory errors | Use a smaller model such as `qwen2.5:3b`. |
| Port 3001 already in use | Change `server.port` in `vite.config.ts` or stop the other process. |
