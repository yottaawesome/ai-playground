# agent-loop

A minimal, Claude-Code-style **agent loop** written in modern C++ (C++23
modules, `import std`, MSVC `stdcpplatest`). It's a sketch — under ~400 lines
of code — that shows the core pattern powering "AI coding assistant" products:

```
user prompt ─▶ LLM ─▶ tool_use? ─▶ execute tool ─▶ feed result back ─▶ LLM ─▶ …
                 └──── end_turn ────▶ print text, wait for next user input
```

## Pieces

| Module partition  | Role                                                  |
| ----------------- | ----------------------------------------------------- |
| `agent:llm`       | Thin HTTPS client over Anthropic's Messages API (cpr) |
| `agent:tools`     | Registry + three sandboxed file tools                 |
| `agent:loop`      | The send / tool-use / execute / repeat loop + REPL    |

Built-in tools: `read_file`, `list_dir`, `write_file`. All paths are resolved
under a workspace root and rejected if they escape it.

## Build

Uses vcpkg manifest mode. Open `agent-loop.slnx` in Visual Studio 2022+ (or
MSBuild from the command line) with the vcpkg integration enabled. Dependencies
(`cpr`, `nlohmann-json`) are declared in `vcpkg.json`.

## Run

```
set ANTHROPIC_API_KEY=sk-ant-...
agent-loop.exe [workspace-root]
```

Then chat at the `you>` prompt. Type `exit` to quit.

## What this is not

This is a teaching sketch, not a product. It deliberately skips:

- streaming responses
- retries, backoff, rate-limit handling
- context-window management and compaction
- approval prompts before destructive actions
- shell execution, grep/glob, diff/patch tools
- sub-agents, plan mode, checkpointing
- evals

Every one of those is a layer real products (Claude Code, Aider, Cline, etc.)
add on top of this same core loop.
