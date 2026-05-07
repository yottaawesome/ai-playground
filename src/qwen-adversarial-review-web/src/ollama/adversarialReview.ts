export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ReviewCriterion {
  name: string
  description: string
}

export interface GeneratedFile {
  path: string
  purpose: string
  content: string
}

export interface GenerationResult {
  summary: string
  files: GeneratedFile[]
}

export interface AssessmentIssue {
  severity: 'critical' | 'major' | 'minor'
  criterion: string
  file: string
  problem: string
  suggestedFix: string
}

export interface AssessmentResult {
  passed: boolean
  overallScore: number
  summary: string
  strengths: string[]
  issues: AssessmentIssue[]
}

interface OllamaChatResponse {
  message?: {
    content?: string
  }
}

export interface RunGenerationOptions {
  baseUrl: string
  model: string
  task: string
  criteria: ReviewCriterion[]
  signal: AbortSignal
}

export interface RunAssessmentOptions extends RunGenerationOptions {
  generation: GenerationResult
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readString(record: Record<string, unknown>, key: string): string {
  const value = record[key]
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Expected "${key}" to be a non-empty string`)
  }

  return value
}

function readNumber(record: Record<string, unknown>, key: string): number {
  const value = record[key]
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Expected "${key}" to be a finite number`)
  }

  return value
}

function readBoolean(record: Record<string, unknown>, key: string): boolean {
  const value = record[key]
  if (typeof value !== 'boolean') {
    throw new Error(`Expected "${key}" to be a boolean`)
  }

  return value
}

function readStringArray(record: Record<string, unknown>, key: string): string[] {
  const value = record[key]
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new Error(`Expected "${key}" to be an array of strings`)
  }

  return value
}

function parseJsonObject(content: string): unknown {
  const trimmed = content.trim()

  try {
    return JSON.parse(trimmed)
  } catch {
    const fencedBlock = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
    if (fencedBlock) return JSON.parse(fencedBlock[1])

    const start = trimmed.indexOf('{')
    const end = trimmed.lastIndexOf('}')
    if (start !== -1 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1))
    }

    throw new Error('The model did not return a JSON object')
  }
}

function normalizeGeneration(value: unknown): GenerationResult {
  if (!isRecord(value)) throw new Error('Generation response must be a JSON object')

  const summary = readString(value, 'summary')
  const filesValue = value.files
  if (!Array.isArray(filesValue) || filesValue.length === 0) {
    throw new Error('Generation response must include a non-empty "files" array')
  }

  const files = filesValue.map((fileValue, index) => {
    if (!isRecord(fileValue)) throw new Error(`Generated file ${index + 1} must be an object`)

    return {
      path: readString(fileValue, 'path'),
      purpose: readString(fileValue, 'purpose'),
      content: readString(fileValue, 'content'),
    }
  })

  return { summary, files }
}

function normalizeAssessment(value: unknown): AssessmentResult {
  if (!isRecord(value)) throw new Error('Assessment response must be a JSON object')

  const issuesValue = value.issues
  if (!Array.isArray(issuesValue)) {
    throw new Error('Assessment response must include an "issues" array')
  }

  const issues = issuesValue.map((issueValue, index): AssessmentIssue => {
    if (!isRecord(issueValue)) throw new Error(`Issue ${index + 1} must be an object`)

    const severity = readString(issueValue, 'severity')
    if (severity !== 'critical' && severity !== 'major' && severity !== 'minor') {
      throw new Error(`Issue ${index + 1} has an invalid severity`)
    }

    return {
      severity,
      criterion: readString(issueValue, 'criterion'),
      file: readString(issueValue, 'file'),
      problem: readString(issueValue, 'problem'),
      suggestedFix: readString(issueValue, 'suggestedFix'),
    }
  })

  return {
    passed: readBoolean(value, 'passed'),
    overallScore: Math.max(0, Math.min(100, readNumber(value, 'overallScore'))),
    summary: readString(value, 'summary'),
    strengths: readStringArray(value, 'strengths'),
    issues,
  }
}

async function callOllamaJson({
  baseUrl,
  model,
  messages,
  signal,
  temperature,
}: {
  baseUrl: string
  model: string
  messages: ChatMessage[]
  signal: AbortSignal
  temperature: number
}) {
  const response = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      model,
      messages,
      stream: false,
      format: 'json',
      options: {
        temperature,
      },
    }),
  })

  if (!response.ok) {
    throw new Error(`Ollama API error: ${response.status} ${response.statusText}`)
  }

  const payload = (await response.json()) as OllamaChatResponse
  const content = payload.message?.content
  if (!content) {
    throw new Error('Ollama response did not include message.content')
  }

  return parseJsonObject(content)
}

export function parseCriteria(criteriaText: string): ReviewCriterion[] {
  const criteria = criteriaText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const separator = line.indexOf(':')
      if (separator === -1) {
        return { name: line, description: line }
      }

      return {
        name: line.slice(0, separator).trim(),
        description: line.slice(separator + 1).trim(),
      }
    })

  if (criteria.length === 0) {
    throw new Error('Add at least one review criterion')
  }

  return criteria
}

export function buildGeneratorMessages(task: string, criteria: ReviewCriterion[]): ChatMessage[] {
  const criteriaBlock = criteria
    .map((criterion, index) => `${index + 1}. ${criterion.name}: ${criterion.description}`)
    .join('\n')

  return [
    {
      role: 'system',
      content:
        'You are the generator in a two-pass Ollama/Qwen demo. Generate a small, self-contained set of virtual project files. Return only valid JSON.',
    },
    {
      role: 'user',
      content: `Task:
${task}

The next model call will adversarially assess your files against this rubric:
${criteriaBlock}

Return this JSON shape exactly:
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

Keep the sample small enough to review in a browser. Do not include secrets, API keys, real customer names, or private data.`,
    },
  ]
}

export function buildAssessmentMessages({
  task,
  criteria,
  generation,
}: {
  task: string
  criteria: ReviewCriterion[]
  generation: GenerationResult
}): ChatMessage[] {
  const criteriaBlock = criteria
    .map((criterion, index) => `${index + 1}. ${criterion.name}: ${criterion.description}`)
    .join('\n')
  const filesBlock = generation.files
    .map(
      (file) => `File: ${file.path}
Purpose: ${file.purpose}
Content:
\`\`\`
${file.content}
\`\`\``,
    )
    .join('\n\n---\n\n')

  return [
    {
      role: 'system',
      content:
        'You are the adversarial assessor in a two-pass Ollama/Qwen demo. Be strict, specific, and evidence-based. Return only valid JSON.',
    },
    {
      role: 'user',
      content: `Original task:
${task}

Rubric:
${criteriaBlock}

Generated files to assess:
${filesBlock}

Return this JSON shape exactly:
{
  "passed": true,
  "overallScore": 0,
  "summary": "short assessment summary",
  "strengths": ["specific thing done well"],
  "issues": [
    {
      "severity": "critical",
      "criterion": "rubric criterion name",
      "file": "relative/path.ext",
      "problem": "specific problem",
      "suggestedFix": "specific fix"
    }
  ]
}

Scoring guidance:
- 90-100: production-ready for the stated task.
- 70-89: useful but needs small fixes.
- 40-69: incomplete or risky.
- 0-39: fails the task.

Set passed to false if there are any critical issues or if overallScore is below 80.`,
    },
  ]
}

export async function runGeneration({
  baseUrl,
  model,
  task,
  criteria,
  signal,
}: RunGenerationOptions): Promise<GenerationResult> {
  const payload = await callOllamaJson({
    baseUrl,
    model,
    messages: buildGeneratorMessages(task, criteria),
    signal,
    temperature: 0.4,
  })

  return normalizeGeneration(payload)
}

export async function runAssessment({
  baseUrl,
  model,
  task,
  criteria,
  signal,
  generation,
}: RunAssessmentOptions): Promise<AssessmentResult> {
  const payload = await callOllamaJson({
    baseUrl,
    model,
    messages: buildAssessmentMessages({ task, criteria, generation }),
    signal,
    temperature: 0.1,
  })

  return normalizeAssessment(payload)
}
