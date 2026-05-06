import { useMemo, useRef, useState } from 'react'
import './App.css'
import { knowledgeBase } from './rag/knowledgeBase'
import { buildContextBlock, retrieveRelevantChunks, type RetrievedChunk } from './rag/retrieval'
import { buildRagMessages, streamRagAnswer } from './ollama/chat'

const MODELS = ['qwen2.5:7b', 'qwen2.5:14b', 'qwen2.5:3b', 'qwen3.6:latest']

const EXAMPLE_QUESTIONS = [
  'How do I run the Acme Support Portal locally?',
  'What changed in release 4.2?',
  'How does ticket search pagination work?',
  'What should be escalated as a critical incident?',
  'What do I do if the browser cannot call Ollama from Vite?',
]

export default function App() {
  const [baseUrl, setBaseUrl] = useState('http://localhost:11434')
  const [model, setModel] = useState(MODELS[0])
  const [question, setQuestion] = useState(EXAMPLE_QUESTIONS[0])
  const [maxChunks, setMaxChunks] = useState(3)
  const [retrievedChunks, setRetrievedChunks] = useState<RetrievedChunk[]>([])
  const [answer, setAnswer] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const abortControllerRef = useRef<AbortController | null>(null)

  const promptPreview = useMemo(() => {
    const messages = buildRagMessages(question, retrievedChunks)
    return messages.map((message) => `${message.role.toUpperCase()}\n${message.content}`).join('\n\n---\n\n')
  }, [question, retrievedChunks])

  const handleAsk = async () => {
    const trimmedQuestion = question.trim()
    if (!trimmedQuestion || isLoading) return

    abortControllerRef.current?.abort()
    abortControllerRef.current = new AbortController()

    const chunks = retrieveRelevantChunks(trimmedQuestion, maxChunks)
    setRetrievedChunks(chunks)
    setAnswer('')
    setError(null)
    setIsLoading(true)

    try {
      await streamRagAnswer({
        baseUrl,
        model,
        question: trimmedQuestion,
        chunks,
        signal: abortControllerRef.current.signal,
        onToken: (token) => {
          setAnswer((currentAnswer) => `${currentAnswer}${token}`)
        },
      })
    } catch (sendError) {
      if (sendError instanceof DOMException && sendError.name === 'AbortError') return

      const message = sendError instanceof Error ? sendError.message : 'Unknown Ollama error'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleStop = () => {
    abortControllerRef.current?.abort()
    setIsLoading(false)
  }

  return (
    <div className="app">
      <header className="hero">
        <div>
          <p className="eyebrow">Ollama + Qwen sample</p>
          <h1>RAG Web Demo</h1>
          <p>
            Ask a question about the mock Acme docs. The app retrieves matching chunks, injects
            them into the prompt, and streams a cited answer from Qwen through Ollama.
          </p>
        </div>
      </header>

      <main className="layout">
        <section className="panel controls">
          <h2>Ask</h2>
          <label>
            Question
            <textarea
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              rows={4}
              placeholder="Ask about the Acme mock docs..."
            />
          </label>

          <div className="examples">
            {EXAMPLE_QUESTIONS.map((example) => (
              <button
                key={example}
                type="button"
                className="chip"
                onClick={() => setQuestion(example)}
                disabled={isLoading}
              >
                {example}
              </button>
            ))}
          </div>

          <div className="settings-grid">
            <label>
              Ollama URL
              <input value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} />
            </label>
            <label>
              Qwen model
              <select value={model} onChange={(event) => setModel(event.target.value)}>
                {MODELS.map((modelName) => (
                  <option key={modelName} value={modelName}>
                    {modelName}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Retrieved chunks
              <select
                value={maxChunks}
                onChange={(event) => setMaxChunks(Number(event.target.value))}
              >
                <option value={1}>1</option>
                <option value={2}>2</option>
                <option value={3}>3</option>
                <option value={4}>4</option>
                <option value={5}>5</option>
              </select>
            </label>
          </div>

          <div className="button-row">
            <button type="button" onClick={handleAsk} disabled={isLoading || !question.trim()}>
              {isLoading ? 'Asking Qwen...' : 'Retrieve + ask Qwen'}
            </button>
            {isLoading && (
              <button type="button" className="secondary" onClick={handleStop}>
                Stop
              </button>
            )}
          </div>

          {error && <p className="error">{error}</p>}
        </section>

        <section className="panel">
          <div className="panel-heading">
            <h2>Retrieved context</h2>
            <span>{retrievedChunks.length} chunks from {knowledgeBase.length}</span>
          </div>
          {retrievedChunks.length === 0 ? (
            <p className="muted">Run a question to see which mock documents are retrieved.</p>
          ) : (
            <div className="chunk-list">
              {retrievedChunks.map((chunk) => (
                <article key={chunk.id} className="chunk-card">
                  <div className="chunk-title">
                    <strong>[{chunk.id}]</strong>
                    <span>score {chunk.score}</span>
                  </div>
                  <h3>{chunk.title}</h3>
                  <p className="source">{chunk.source}</p>
                  <p>{chunk.content}</p>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="panel answer-panel">
          <h2>Generated answer</h2>
          {answer ? (
            <div className="answer">{answer}</div>
          ) : (
            <p className="muted">
              The answer will stream here. It should cite chunk IDs like [api-search].
            </p>
          )}
        </section>

        <section className="panel prompt-panel">
          <h2>Prompt sent to Ollama</h2>
          <pre>{promptPreview}</pre>
        </section>

        <section className="panel context-panel">
          <h2>Raw context block</h2>
          <pre>{buildContextBlock(retrievedChunks)}</pre>
        </section>
      </main>
    </div>
  )
}
