import type { RetrievedChunk } from '../rag/retrieval'
import { buildContextBlock } from '../rag/retrieval'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface OllamaChatChunk {
  message?: {
    content?: string
  }
  done?: boolean
}

export interface StreamRagAnswerOptions {
  baseUrl: string
  model: string
  question: string
  chunks: RetrievedChunk[]
  signal: AbortSignal
  onToken: (token: string) => void
}

export function buildRagMessages(question: string, chunks: RetrievedChunk[]): ChatMessage[] {
  const contextBlock = buildContextBlock(chunks)

  return [
    {
      role: 'system',
      content:
        'You are a RAG demo assistant. Answer only from the provided context. If the context does not contain the answer, say that the retrieved context does not include enough information. Cite relevant chunk IDs in square brackets, such as [api-search].',
    },
    {
      role: 'user',
      content: `${contextBlock}\n\nQuestion: ${question}\n\nAnswer with concise citations.`,
    },
  ]
}

export async function streamRagAnswer({
  baseUrl,
  model,
  question,
  chunks,
  signal,
  onToken,
}: StreamRagAnswerOptions) {
  const response = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      model,
      messages: buildRagMessages(question, chunks),
      stream: true,
      options: {
        temperature: 0.2,
      },
    }),
  })

  if (!response.ok) {
    throw new Error(`Ollama API error: ${response.status} ${response.statusText}`)
  }

  const reader = response.body?.getReader()
  if (!reader) throw new Error('Ollama response did not include a readable stream')

  const decoder = new TextDecoder()
  let buffer = ''

  const processLine = (line: string) => {
    if (!line.trim()) return

    const chunk = JSON.parse(line) as OllamaChatChunk
    const content = chunk.message?.content
    if (content) onToken(content)
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    lines.forEach(processLine)
  }

  processLine(buffer)
}
