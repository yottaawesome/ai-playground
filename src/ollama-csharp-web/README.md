# Ollama C# Chat

`ollama-csharp-web` is a Blazor Server chat app that talks to a local Ollama API from C# and renders assistant responses as Markdown.

The app is intentionally server-side: the browser connects to the ASP.NET Core app, and the ASP.NET Core app calls Ollama at `http://localhost:11434`. That avoids the browser CORS setup required by direct Vite-to-Ollama clients.

## Features

| Feature | Notes |
| --- | --- |
| Local Ollama chat | Uses `POST /api/chat` with streaming enabled. |
| Model dropdown | Loads locally installed models from `GET /api/tags`. |
| Markdown output | Uses Markdig to render headings, lists, tables, blockquotes, and code blocks. Raw HTML in Markdown is disabled. |
| Streaming UI | Appends assistant tokens as Ollama sends them. |
| Chat controls | Includes Refresh models, Clear chat, Send, and Stop streaming controls. |

## Required software

Install these on Windows before running the app:

1. .NET SDK 8 or newer.
2. Ollama for Windows.
3. At least one local Ollama model.
4. PowerShell.

Example setup with `winget`:

```powershell
winget install Microsoft.DotNet.SDK.8
winget install Ollama.Ollama
```

Open a new PowerShell window after installation and check the tools:

```powershell
dotnet --version
ollama --version
```

## Install an Ollama model

The dropdown only shows models installed locally in Ollama. Pull one or more models first:

```powershell
ollama pull qwen2.5:7b
ollama pull llama3.2:3b
ollama pull mistral:7b
```

List installed models:

```powershell
ollama list
```

You can also confirm the HTTP API response used by the app:

```powershell
curl http://localhost:11434/api/tags
```

The response should contain a JSON `models` array.

## Start Ollama

Ollama for Windows usually starts automatically. If the API is not responding, start it manually:

```powershell
ollama serve
```

Keep that PowerShell window open while you run the chat app. In another PowerShell window, confirm the API is reachable:

```powershell
curl http://localhost:11434/api/tags
```

## Run the C# app

From the repository root:

```powershell
Set-Location .\src\ollama-csharp-web
dotnet restore
dotnet run
```

The default launch profile serves the app at:

```text
http://localhost:5153
```

If `dotnet run` uses the HTTPS profile instead, it may also print:

```text
https://localhost:7087
```

Open the URL printed by `dotnet run` in your browser.

## Run without changing directories

From the repository root, you can also run the project directly:

```powershell
dotnet restore .\src\ollama-csharp-web\ollama-csharp-web.csproj
dotnet run --project .\src\ollama-csharp-web\ollama-csharp-web.csproj
```

## Configure the Ollama URL

The default Ollama API base URL is configured in:

```text
src\ollama-csharp-web\appsettings.json
```

Default value:

```json
{
  "Ollama": {
    "BaseUrl": "http://localhost:11434"
  }
}
```

To override it for one PowerShell session without editing files:

```powershell
$env:Ollama__BaseUrl = "http://localhost:11434"
dotnet run --project .\src\ollama-csharp-web\ollama-csharp-web.csproj
```

Use the double underscore in `Ollama__BaseUrl`; ASP.NET Core maps that to `Ollama:BaseUrl`.

## How the chat flow works

1. When the page loads, `OllamaClient.GetModelsAsync` calls `GET /api/tags`.
2. The returned model names populate the dropdown.
3. When you send a prompt, the app sends the full chat history to `POST /api/chat`.
4. Ollama streams newline-delimited JSON chunks.
5. `OllamaClient.StreamChatAsync` parses each chunk and yields the assistant content.
6. The Blazor page appends each chunk to the assistant message and re-renders it through `MarkdownFormatter`.

The C# request body matches Ollama's chat API shape:

```json
{
  "model": "qwen2.5:7b",
  "messages": [
    {
      "role": "user",
      "content": "Give me a Markdown table comparing local LLM runtimes."
    }
  ],
  "stream": true
}
```

## Markdown rendering notes

Assistant output is converted to HTML with Markdig. The stylesheet includes formatting for:

1. Headings and paragraphs.
2. Ordered and unordered lists.
3. Inline code and fenced code blocks.
4. Blockquotes.
5. Tables.

Raw HTML in Markdown is disabled in `Services\MarkdownFormatter.cs`, so model responses render as Markdown content rather than arbitrary HTML.

## Troubleshooting

| Problem | Fix |
| --- | --- |
| `Could not load Ollama models` | Make sure Ollama is running and `curl http://localhost:11434/api/tags` works. |
| Dropdown says `No models found` | Pull a model with `ollama pull qwen2.5:7b`, then click Refresh. |
| Chat request returns 404 or connection refused | Check `Ollama:BaseUrl` in `appsettings.json` or `$env:Ollama__BaseUrl`. |
| Response is very slow | Try a smaller model such as `qwen2.5:3b` or `llama3.2:3b`. |
| Browser CORS errors | This app calls Ollama from server-side C#, so CORS should not apply. Confirm you are opening the Blazor app URL, not calling Ollama directly from browser JavaScript. |
| HTTPS certificate warning | Use the HTTP URL printed by `dotnet run`, or trust the local dev certificate with `dotnet dev-certs https --trust`. |

## Build check

To compile the app without running it:

```powershell
dotnet build .\src\ollama-csharp-web\ollama-csharp-web.csproj
```
