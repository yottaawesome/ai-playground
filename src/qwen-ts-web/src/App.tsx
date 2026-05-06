import { useState } from 'react'
import './App.css'
import { useOllamaChat } from './hooks/useOllamaChat'

const MODELS = ['qwen2.5:7b', 'qwen2.5:14b', 'qwen2.5:3b']

export default function App() {
  const [input, setInput] = useState('')
  const [model, setModel] = useState(MODELS[0])
  const { messages, isLoading, error, sendMessage, clearChat } = useOllamaChat({ model })

  const handleSend = () => {
    if (!input.trim() || isLoading) return

    void sendMessage(input)
    setInput('')
  }

  return (
    <div className="app">
      <header className="header">
        <h1>Qwen Client</h1>
        <select
          value={model}
          onChange={(event) => setModel(event.target.value)}
          aria-label="Model"
        >
          {MODELS.map((modelName) => (
            <option key={modelName} value={modelName}>
              {modelName}
            </option>
          ))}
        </select>
        <button type="button" onClick={clearChat} className="btn-clear">
          Clear
        </button>
      </header>

      <main className="chat">
        {messages.map((message, index) => (
          <div key={`${message.role}-${index}`} className={`msg ${message.role}`}>
            <div className="msg-bubble">{message.content}</div>
          </div>
        ))}
        {isLoading && (
          <div className="msg assistant">
            <div className="msg-bubble">Thinking...</div>
          </div>
        )}
      </main>

      <footer className="footer">
        {error && <div className="error">{error}</div>}
        <div className="input-row">
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') handleSend()
            }}
            placeholder="Ask Qwen..."
          />
          <button type="button" onClick={handleSend} disabled={isLoading}>
            Send
          </button>
        </div>
      </footer>
    </div>
  )
}
