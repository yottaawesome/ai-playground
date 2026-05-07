# qwen-adversarial-review-web

Browser-based multi-pass generation and review sample built with Vite, React, TypeScript, Ollama, and a local Qwen chat model.

The sample demonstrates a simple LLM-as-a-judge loop:

```text
user task -> Qwen generator -> virtual files -> Qwen adversarial assessor -> scored review
```

Both passes use Qwen through Ollama. They are separate API calls with different prompts, not separate model installations. The first call acts as a generator. The second call receives the generated files plus an explicit rubric and acts as a strict reviewer.

## What this sample contains

| File | Purpose |
| --- | --- |
| `src\App.tsx` | UI for configuring the task, rubric, model, and running the two-pass loop. |
| `src\ollama\adversarialReview.ts` | Builds generator and assessor prompts, calls Ollama, parses JSON responses, and validates response shapes. |
| `src\App.css` | Layout and presentation for the control panel, generated files, assessment results, and prompt previews. |
| `vite.config.ts` | Runs the app on `http://localhost:3002`. |

## What the app does

The app has three main actions:

| Action | Behavior |
| --- | --- |
| `Run full loop` | Calls Qwen once to generate virtual files, then calls Qwen again to assess them. |
| `Generate only` | Runs only the generator pass and displays the files. |
| `Assess current files` | Reuses the latest generated files and reruns only the adversarial assessment. |

The files are "virtual" files displayed in the browser. The app does not write generated content to disk. This keeps the sample safe and makes it easy to inspect the model output before copying anything into a real project.

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

Use the exact `name:tag` value from `ollama list` if you change the dropdown values in `src\App.tsx`.

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
http://localhost:3002
```

The browser calls Ollama at:

```text
http://localhost:11434
```

If the browser shows a CORS error, restart Ollama with the Vite origin allowed:

```powershell
$env:OLLAMA_ORIGINS = "http://localhost:3002"
ollama serve
```

For a persistent user-level setting:

```powershell
[Environment]::SetEnvironmentVariable("OLLAMA_ORIGINS", "http://localhost:3002", "User")
```

Restart Ollama after setting a persistent environment variable.

If you use `npm run preview`, Vite may serve on `http://localhost:4173`, so allow both origins:

```powershell
$env:OLLAMA_ORIGINS = "http://localhost:3002,http://localhost:4173"
ollama serve
```

## Run the sample

From the repository root:

```powershell
Set-Location .\src\qwen-adversarial-review-web
npm install
npm run dev
```

Open:

```text
http://localhost:3002
```

## Default task

The app starts with this task:

```text
Create a tiny TypeScript utility package that validates support ticket priority values.

The package should include:
- a function that accepts "low", "normal", "high", or "urgent"
- helpful error messages for invalid input
- a short README showing usage
```

You can replace it with any small generation task. Smaller tasks work better because both the generated files and the adversarial prompt are sent through the local model context window.

## Default rubric

The app starts with these criteria:

```text
Correctness: The generated files satisfy the stated task and handle invalid input clearly.
Completeness: The sample includes all files needed to understand and use the generated utility.
Security and privacy: The output does not include secrets, real customer data, or unsafe practices.
Maintainability: The code is small, readable, typed, and easy to change.
Documentation: The README explains the behavior and gives a realistic usage example.
```

Each line is parsed as either:

```text
Name: Description
```

or, if there is no colon:

```text
Name and description
```

The parsed names are displayed as rubric chips under the criteria editor.

## How the generator pass works

The generator prompt is built in:

```text
src\ollama\adversarialReview.ts
```

It sends two chat messages to Ollama:

```json
[
  {
    "role": "system",
    "content": "You are the generator in a two-pass Ollama/Qwen demo..."
  },
  {
    "role": "user",
    "content": "Task:\n...\n\nThe next model call will adversarially assess your files against this rubric:\n..."
  }
]
```

The request uses Ollama's JSON mode:

```json
{
  "model": "qwen2.5:7b",
  "messages": "...",
  "stream": false,
  "format": "json",
  "options": {
    "temperature": 0.4
  }
}
```

The generator is asked to return:

```json
{
  "summary": "one paragraph summary of what you generated",
  "files": [
    {
      "path": "relative/path.ext",
      "purpose": "why this file exists",
      "content": "complete file contents"
    }
  ]
}
```

The app validates that `summary` is present and that each file has a non-empty `path`, `purpose`, and `content`.

## How the adversarial assessment pass works

The assessor receives:

1. The original task.
2. The same rubric.
3. The generated virtual file contents.

It is prompted to be strict, specific, and evidence-based. It returns:

```json
{
  "passed": true,
  "overallScore": 90,
  "summary": "short assessment summary",
  "strengths": ["specific thing done well"],
  "issues": [
    {
      "severity": "major",
      "criterion": "Correctness",
      "file": "src/index.ts",
      "problem": "The validator accepts empty strings.",
      "suggestedFix": "Reject empty strings before checking allowed values."
    }
  ]
}
```

The app validates:

1. `passed` is a boolean.
2. `overallScore` is a finite number and is clamped to `0-100`.
3. `strengths` is an array of strings.
4. `issues` is an array.
5. Each issue has severity `critical`, `major`, or `minor`.

## Why use the same model twice?

This sample uses the same Qwen model twice to make the pattern easy to run locally. The "instances" are logical roles created by different prompts:

```text
Qwen call 1: act as generator
Qwen call 2: act as adversarial assessor
```

That is useful for demos and experimentation, but the assessor can share blind spots with the generator. For stronger review, use a different or larger model as the assessor, run multiple assessor prompts, or combine the LLM review with deterministic checks.

## How this compares to production review loops

Production systems usually combine LLM review with hard validation:

```text
generate files
run formatter, type-checker, tests, security tools
ask an LLM judge to review files and command output
apply revisions
rerun checks
send to human review
```

The LLM assessor is a review signal, not proof of correctness. Automated tests, linters, type-checkers, static analysis, and human review still matter.

## Things to try

1. Make the generator task intentionally ambiguous and see whether the assessor catches missing requirements.
2. Add a security criterion and ask the generator for an API client.
3. Raise the generator temperature and compare assessment scores.
4. Use `qwen2.5:3b` for generation and `qwen2.5:14b` for assessment by changing the model between passes.
5. Copy an issue's suggested fix into the task and rerun the full loop.

## Available scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Starts the Vite development server on port `3002`. |
| `npm run build` | Type-checks and builds the production app into `dist`. |
| `npm run lint` | Runs ESLint over the project. |
| `npm run preview` | Serves the production build locally for preview. |

## Troubleshooting

| Problem | What to check |
| --- | --- |
| `Ollama API error: 404` or model not found | Run `ollama list` and choose an installed model tag. |
| Browser CORS error | Set `OLLAMA_ORIGINS` to include `http://localhost:3002` and restart Ollama. |
| `The model did not return a JSON object` | Rerun the step, simplify the task, or use a stronger Qwen model. |
| Slow responses | The app makes two model calls; the first request may also load the model into memory. |
| Out-of-memory errors | Use a smaller model such as `qwen2.5:3b`, or reduce the generated file size. |
| Port 3002 already in use | Change `server.port` in `vite.config.ts` or stop the other process. |
