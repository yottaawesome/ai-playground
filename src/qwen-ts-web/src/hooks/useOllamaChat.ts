import { useCallback, useRef, useState } from 'react'

export interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface UseOllamaChatOptions {
  model?: string
  baseUrl?: string
}

interface OllamaChunk {
  message?: {
    content?: string
  }
}

export function useOllamaChat({
  model = 'qwen2.5:7b',
  baseUrl = 'http://localhost:11434',
}: UseOllamaChatOptions = {}) {
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const messagesRef = useRef<Message[]>([])
  const abortControllerRef = useRef<AbortController | null>(null)

  const syncMessages = useCallback((nextMessages: Message[]) => {
    messagesRef.current = nextMessages
    setMessages(nextMessages)
  }, [])

  const sendMessage = useCallback(
    async (prompt: string) => {
      if (!prompt.trim() || isLoading) return

      abortControllerRef.current?.abort()
      abortControllerRef.current = new AbortController()

      const userMessage: Message = { role: 'user', content: prompt }
      const requestMessages = [...messagesRef.current, userMessage]

      syncMessages([...requestMessages, { role: 'assistant', content: '' }])
      setIsLoading(true)
      setError(null)

      try {
        const response = await fetch(`${baseUrl}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: abortControllerRef.current.signal,
          body: JSON.stringify({ model, messages: requestMessages, stream: true }),
        })

        if (!response.ok) {
          throw new Error(`API Error: ${response.status} ${response.statusText}`)
        }

        const reader = response.body?.getReader()
        if (!reader) throw new Error('No stream reader')

        const decoder = new TextDecoder()
        let buffer = ''
        let assistantContent = ''

        const appendAssistantContent = (line: string) => {
          if (!line.trim()) return

          try {
            const chunk = JSON.parse(line) as OllamaChunk
            const content = chunk.message?.content
            if (!content) return

            assistantContent += content
            syncMessages([...requestMessages, { role: 'assistant', content: assistantContent }])
          } catch (parseError) {
            console.warn('Ignoring malformed Ollama stream chunk', parseError)
          }
        }

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''
          lines.forEach(appendAssistantContent)
        }

        appendAssistantContent(buffer)
      } catch (sendError) {
        if (sendError instanceof DOMException && sendError.name === 'AbortError') return

        const message = sendError instanceof Error ? sendError.message : 'Unknown Ollama error'
        setError(message)
        syncMessages(messagesRef.current.slice(0, -1))
      } finally {
        setIsLoading(false)
      }
    },
    [baseUrl, isLoading, model, syncMessages],
  )

  const clearChat = useCallback(() => {
    abortControllerRef.current?.abort()
    syncMessages([])
    setError(null)
  }, [syncMessages])

  return { messages, isLoading, error, sendMessage, clearChat }
}
