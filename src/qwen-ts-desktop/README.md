# qwen-ts-desktop

Desktop Qwen chat client built with Tauri v2, React, Vite, and TypeScript. It packages the same Qwen/Ollama chat frontend used by `..\qwen-ts-web` into a native Windows desktop shell.

## What it does

- Opens a native desktop window titled `Qwen Desktop`.
- Runs the React frontend through Vite during development.
- Sends chat messages to Ollama's local `/api/chat` endpoint.
- Streams Qwen responses into the assistant message as Ollama returns chunks.
- Lets you choose between `qwen2.5:7b`, `qwen2.5:14b`, and `qwen2.5:3b`.
- Builds distributable desktop bundles through Tauri.

## How it works

The app has two parts:

1. The React frontend in `src\` renders the chat UI and talks directly to Ollama at `http://localhost:11434`.
2. The Tauri shell in `src-tauri\` launches the frontend inside a desktop WebView window.

The frontend entry point is `src\main.tsx`, and the chat UI is in `src\App.tsx`.

The Ollama integration is in `src\hooks\useOllamaChat.ts`. The hook:

1. Tracks chat messages in React state and a ref.
2. Sends `POST http://localhost:11434/api/chat` with `{ model, messages, stream: true }`.
3. Reads Ollama's streaming newline-delimited JSON response.
4. Appends each `chunk.message.content` value to the assistant message.
5. Uses `AbortController` so in-flight requests can be cancelled.

The desktop configuration is in `src-tauri\tauri.conf.json`. It sets:

- `productName`: `Qwen Desktop`
- `devUrl`: `http://localhost:3000`
- `frontendDist`: `..\dist`
- window size: `900x700`
- build hooks: `npm run dev` for development and `npm run build` for production

## Prerequisites on Windows

Install these before running the desktop app:

- Node.js 24 or newer.
- npm, included with Node.js.
- Ollama for Windows.
- A Rust toolchain for Tauri.
- Microsoft Visual Studio Build Tools with the C++ desktop workload, required by Rust/Tauri on Windows.
- At least one Qwen model pulled into Ollama.

Example PowerShell setup:

```powershell
winget install OpenJS.NodeJS
winget install Ollama.Ollama
winget install Rustlang.Rustup
rustup toolchain install stable
ollama pull qwen2.5:7b
```

Install Visual Studio Build Tools from Microsoft if Rust compilation fails because the MSVC linker or Windows SDK is missing.

If you want the larger or smaller models shown in the app:

```powershell
ollama pull qwen2.5:14b
ollama pull qwen2.5:3b
```

## Install dependencies

From the repository root:

```powershell
Set-Location .\src\qwen-ts-desktop
npm install
```

## Run locally

Start Ollama first:

```powershell
ollama serve
```

In another PowerShell window, start the Tauri desktop app:

```powershell
Set-Location .\src\qwen-ts-desktop
npm run tauri:dev
```

Tauri will run the Vite dev server on `http://localhost:3000` and open the desktop window.

Do not run `qwen-ts-web` and `qwen-ts-desktop` in development at the same time unless you change one app's Vite port, because both currently use port `3000`.

## Build

Build the frontend only:

```powershell
Set-Location .\src\qwen-ts-desktop
npm run build
```

Build the desktop bundle:

```powershell
Set-Location .\src\qwen-ts-desktop
npm run tauri:build
```

Tauri outputs installers and bundles under `src-tauri\target\release\bundle`.

## Available scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Starts the Vite frontend on port `3000`. |
| `npm run build` | Type-checks and builds the frontend into `dist`. |
| `npm run preview` | Serves the production frontend build locally. |
| `npm run tauri` | Runs the Tauri CLI. |
| `npm run tauri:dev` | Starts the full desktop app in development mode. |
| `npm run tauri:build` | Builds the production desktop app bundle. |

## Notes

- Ollama must be running on `http://localhost:11434`.
- The selected model must already exist locally in Ollama.
- Chat history is only held in React state and is lost when the app closes or reloads.
- This app shares its chat UI and Ollama hook with `..\qwen-ts-web`.
