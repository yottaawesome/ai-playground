# Ollama CLI Markdown

`ollama-cli-markdown` is a C# console wrapper for the local `ollama` command.

It has two modes:

| Mode | Behavior |
| --- | --- |
| Regular Ollama commands | Passed through to `ollama` unchanged. Output is not Markdown-formatted. |
| Chat mode | Uses `ollama run <model> <prompt>` for model prompts, keeps a wrapper-session transcript for context, and renders model responses as Markdown in the terminal. |

## Requirements

1. .NET SDK 8 or newer.
2. Ollama installed locally and available on `PATH`.
3. At least one local Ollama model.

Check the tools:

```powershell
dotnet --version
ollama --version
ollama list
```

Pull a model if needed:

```powershell
ollama pull qwen2.5:7b
```

## Run regular Ollama commands

From the repository root:

```powershell
dotnet run --project .\src\ollama-cli-markdown -- list
dotnet run --project .\src\ollama-cli-markdown -- show qwen3.6:latest
dotnet run --project .\src\ollama-cli-markdown -- ps
```

These commands run as normal `ollama` commands. The app does not format their output as Markdown.

## Run Markdown chat mode

Start chat mode with a model name:

```powershell
dotnet run --project .\src\ollama-cli-markdown -- chat qwen2.5:7b
```

For each model prompt, the app runs:

```text
ollama run qwen2.5:7b "<prompt>"
```

Regular Ollama commands still pass through unchanged. Chat mode is different: the wrapper keeps the current chat transcript in memory and includes that transcript in subsequent prompts so the model can answer with same-session context.

Inside chat mode:

```text
chat:qwen2.5:7b> Give me a Markdown table comparing C# and TypeScript.
```

The assistant response is rendered with terminal formatting for common Markdown features:

1. Headings.
2. Bulleted and numbered lists.
3. Blockquotes.
4. Inline code.
5. Fenced code blocks.
6. Markdown tables, with padded columns so table cells line up in the terminal.
7. Links, bold, and italics.

If a model emits an internal reasoning section as `<think>...</think>` or as `Thinking...` through `...done thinking.`, the wrapper prints that section in darker dim text and then resumes normal Markdown rendering for the final answer.

## Chat mode commands

| Command | Behavior |
| --- | --- |
| `/exit` | Leaves chat mode. |
| `/quit` | Same as `/exit`. |
| `/bye` | Same as `/exit`. |
| `/clear` | Clears this wrapper session's in-memory transcript. |
| `/help` | Shows chat mode help. |

Slash-command output is printed raw because it is wrapper status output, not a model response.

## Interactive wrapper shell

You can start the wrapper without arguments:

```powershell
dotnet run --project .\src\ollama-cli-markdown
```

Then type commands at the wrapper prompt:

```text
ollama-md> list
ollama-md> show qwen2.5:7b
ollama-md> chat qwen2.5:7b
ollama-md> exit
```

In this shell, regular commands are sent to `ollama` unchanged. Only `chat <model>` enters Markdown-formatted model chat mode.

## Build

From the repository root:

```powershell
dotnet build .\src\ollama-cli-markdown\ollama-cli-markdown.csproj
```

## Session context

The app does not store history on disk. The transcript exists only while chat mode is open.

The first implementation attempted to keep one redirected interactive `ollama run` child process alive. In this Windows console environment, redirected interactive `ollama run` accepted slash commands but did not reliably emit model responses for normal prompts without a real terminal/PTY. The current implementation keeps the wrapper session reliable by using one local Ollama CLI invocation per prompt and injecting the in-memory transcript for context.

For API-based chat with a browser UI, use the sibling `src\ollama-csharp-web` app.
