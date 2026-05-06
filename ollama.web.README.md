# Developing `qwen-ts-web` locally with Ollama on Windows

This guide explains how to run the `src\qwen-ts-web` React web app against a local Ollama server and locally installed Ollama models.

## What the app uses

| Component | Location or URL | Purpose |
| --- | --- | --- |
| Web app source | `src\qwen-ts-web` | Vite, React, and TypeScript browser app. |
| Main UI | `src\qwen-ts-web\src\App.tsx` | Renders chat messages, model selector, input box, and Clear button. |
| Ollama hook | `src\qwen-ts-web\src\hooks\useOllamaChat.ts` | Sends chat requests to Ollama and streams responses back into React state. |
| Vite dev server | `http://localhost:3000` | Local browser URL for development. |
| Ollama API server | `http://localhost:11434` | Local LLM API used by the app. |
| Chat endpoint | `POST http://localhost:11434/api/chat` | Endpoint used by this app for chat-style prompts. |
| Model list endpoint | `GET http://localhost:11434/api/tags` | Lists models installed locally in Ollama. |

## Required software

Install these on the Windows machine:

1. Windows 10 or Windows 11.
2. PowerShell 7 or Windows PowerShell.
3. Git for Windows, if you need to clone or update the repository.
4. Node.js and npm. The project currently uses Vite, React, TypeScript, and npm scripts.
5. Ollama for Windows.
6. One or more local Ollama models, such as `qwen2.5:7b`.
7. A code editor such as Visual Studio Code.

Example installation with `winget`:

```powershell
winget install Git.Git
winget install OpenJS.NodeJS
winget install Ollama.Ollama
winget install Microsoft.VisualStudioCode
```

After installation, open a new PowerShell window so `git`, `node`, `npm`, and `ollama` are available on `PATH`.

Check the tools:

```powershell
git --version
node --version
npm --version
ollama --version
```

## Install local Ollama models

Ollama model names use this form:

```text
model-name:tag
```

The part after the colon is the model version or variant tag. For example:

| Model string | Meaning |
| --- | --- |
| `qwen2.5:3b` | Qwen 2.5, 3 billion parameter variant. |
| `qwen2.5:7b` | Qwen 2.5, 7 billion parameter variant. |
| `qwen2.5:14b` | Qwen 2.5, 14 billion parameter variant. |
| `qwen3.6:latest` | The `latest` tag for the `qwen3.6` model name, if available locally. |

Pull the models you want to use:

```powershell
ollama pull qwen2.5:7b
ollama pull qwen2.5:3b
ollama pull qwen2.5:14b
```

List installed models:

```powershell
ollama list
```

You can also query the local API:

```powershell
curl http://localhost:11434/api/tags
```

The app can only use models that appear in `ollama list` or `GET /api/tags`. If the selected model is not installed, Ollama returns an error.

## Start Ollama

Ollama usually starts automatically after installing Ollama for Windows. The API listens on:

```text
http://localhost:11434
```

If it is not running, start it manually:

```powershell
ollama serve
```

Confirm that the API responds:

```powershell
curl http://localhost:11434/api/tags
```

Expected result: JSON containing a `models` array.

## Allow browser access from the Vite dev server

The web app runs in the browser at:

```text
http://localhost:3000
```

The browser calls Ollama at:

```text
http://localhost:11434
```

If the browser reports a CORS error, restart Ollama with `OLLAMA_ORIGINS` set to the Vite origin:

```powershell
$env:OLLAMA_ORIGINS = "http://localhost:3000"
ollama serve
```

If you also use Vite preview, allow both development and preview origins:

```powershell
$env:OLLAMA_ORIGINS = "http://localhost:3000,http://localhost:4173"
ollama serve
```

For a persistent user-level environment variable:

```powershell
[Environment]::SetEnvironmentVariable("OLLAMA_ORIGINS", "http://localhost:3000", "User")
```

Restart Ollama after changing the persistent value.

## Install and run the web app

From the repository root:

```powershell
Set-Location .\src\qwen-ts-web
npm install
npm run dev
```

Open the app:

```text
http://localhost:3000
```

The Vite server port is configured in:

```text
src\qwen-ts-web\vite.config.ts
```

The current config sets:

```ts
server: { port: 3000 }
```

## How the app sends chat requests

The Ollama integration is implemented in:

```text
src\qwen-ts-web\src\hooks\useOllamaChat.ts
```

The hook defaults to:

```ts
model = 'qwen2.5:7b'
baseUrl = 'http://localhost:11434'
```

When a user sends a message, the hook calls:

```text
POST http://localhost:11434/api/chat
```

With this JSON shape:

```json
{
  "model": "qwen2.5:7b",
  "messages": [
    {
      "role": "user",
      "content": "Explain how Ollama streaming works."
    }
  ],
  "stream": true
}
```

For multi-turn chat, `messages` includes the previous conversation:

```json
{
  "model": "qwen2.5:7b",
  "messages": [
    {
      "role": "user",
      "content": "Give me a short TypeScript example."
    },
    {
      "role": "assistant",
      "content": "Here is a small TypeScript function..."
    },
    {
      "role": "user",
      "content": "Now make it async."
    }
  ],
  "stream": true
}
```

Ollama supports these common chat message roles:

| Role | Usage |
| --- | --- |
| `system` | Optional instruction that sets behavior for the model. |
| `user` | Prompt entered by the user. |
| `assistant` | Previous model response, used for chat history. |

Example request with a system message:

```json
{
  "model": "qwen2.5:7b",
  "messages": [
    {
      "role": "system",
      "content": "You are a concise TypeScript assistant."
    },
    {
      "role": "user",
      "content": "Write a Vite React component."
    }
  ],
  "stream": true
}
```

## How to specify model versions

The selected model is passed as the `model` field in the JSON request:

```json
{
  "model": "qwen2.5:14b",
  "messages": [
    {
      "role": "user",
      "content": "Use the 14b model for this request."
    }
  ],
  "stream": true
}
```

Use the exact model name and tag shown by:

```powershell
ollama list
```

Examples:

```text
qwen2.5:3b
qwen2.5:7b
qwen2.5:14b
qwen2.5-coder:7b
llama3.2:latest
```

If a tag is omitted in some Ollama commands, Ollama may assume `latest`. In the web app, prefer explicit tags such as `qwen2.5:7b` so requests are predictable.

The app's model dropdown is defined in:

```text
src\qwen-ts-web\src\App.tsx
```

Current values:

```ts
const MODELS = ['qwen2.5:7b', 'qwen2.5:14b', 'qwen2.5:3b', 'qwen3.6:latest']
```

To add another installed local model, add its exact `ollama list` name to `MODELS`.

## Streaming response format

The app sends `"stream": true`, so Ollama returns newline-delimited JSON. Each line is a separate JSON object.

Typical streamed chunk:

```json
{
  "model": "qwen2.5:7b",
  "created_at": "2026-05-07T00:00:00Z",
  "message": {
    "role": "assistant",
    "content": "Ollama"
  },
  "done": false
}
```

Another chunk may contain the next token or text fragment:

```json
{
  "model": "qwen2.5:7b",
  "created_at": "2026-05-07T00:00:01Z",
  "message": {
    "role": "assistant",
    "content": " streams"
  },
  "done": false
}
```

The final object has:

```json
{
  "model": "qwen2.5:7b",
  "done": true
}
```

`useOllamaChat.ts` reads the response body as a stream, splits it on newlines, parses each JSON line, and appends `chunk.message.content` to the current assistant message.

## Non-streaming requests

For simpler debugging outside the app, set `"stream": false`:

```powershell
$body = @{
  model = "qwen2.5:7b"
  messages = @(
    @{
      role = "user"
      content = "Say hello from Ollama."
    }
  )
  stream = $false
} | ConvertTo-Json -Depth 5

Invoke-RestMethod `
  -Uri "http://localhost:11434/api/chat" `
  -Method Post `
  -ContentType "application/json" `
  -Body $body
```

This returns one JSON response instead of newline-delimited streaming chunks.

## Optional request settings

Ollama accepts request options for model behavior. For example:

```json
{
  "model": "qwen2.5:7b",
  "messages": [
    {
      "role": "user",
      "content": "Summarize this in one paragraph."
    }
  ],
  "stream": true,
  "options": {
    "temperature": 0.2,
    "num_ctx": 4096
  }
}
```

Common options:

| Option | Purpose |
| --- | --- |
| `temperature` | Lower values are more deterministic; higher values are more varied. |
| `num_ctx` | Context window size, if supported by the model and available memory. |
| `top_p` | Nucleus sampling control. |
| `seed` | Helps make output more repeatable when supported. |

The current `qwen-ts-web` hook sends only `model`, `messages`, and `stream`. Add `options` to the request body if the app needs configurable generation settings.

## Useful local API checks

List local models:

```powershell
curl http://localhost:11434/api/tags
```

Show model details:

```powershell
ollama show qwen2.5:7b
```

Test a model from the command line:

```powershell
ollama run qwen2.5:7b "Write one sentence about TypeScript."
```

Send a direct API chat request:

```powershell
$body = @{
  model = "qwen2.5:7b"
  messages = @(
    @{
      role = "user"
      content = "Reply with JSON containing a greeting."
    }
  )
  stream = $false
} | ConvertTo-Json -Depth 5

Invoke-RestMethod `
  -Uri "http://localhost:11434/api/chat" `
  -Method Post `
  -ContentType "application/json" `
  -Body $body
```

## Build and preview

From `src\qwen-ts-web`:

```powershell
npm run build
npm run preview
```

The production build is written to:

```text
src\qwen-ts-web\dist
```

Vite preview commonly serves on:

```text
http://localhost:4173
```

If preview calls Ollama directly from the browser, include `http://localhost:4173` in `OLLAMA_ORIGINS`.

## Troubleshooting

| Problem | What to check |
| --- | --- |
| Browser cannot connect to Ollama | Confirm Ollama is running and `curl http://localhost:11434/api/tags` returns JSON. |
| CORS error in the browser | Start Ollama with `OLLAMA_ORIGINS` containing `http://localhost:3000`. |
| Model not found | Run `ollama list` and select or configure an installed model name exactly. |
| First response is slow | The model may be loading into memory. Later responses are usually faster. |
| Out of memory or very slow responses | Use a smaller model tag such as `qwen2.5:3b`, close other GPU or memory-heavy apps, or reduce context size. |
| Port 3000 is already in use | Stop the process using port 3000 or change `server.port` in `src\qwen-ts-web\vite.config.ts`. |
| Port 11434 is unavailable | Restart Ollama or check whether another process is using the port. |

## Security notes for local development

Keep the local Ollama API bound to trusted local development use unless you intentionally configure otherwise. Do not expose `http://localhost:11434` or a custom Ollama host to untrusted networks without adding appropriate network and application-level controls.
