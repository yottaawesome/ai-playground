import { useMemo, useRef, useState } from 'react'
import './App.css'
import {
  buildAssessmentMessages,
  buildGeneratorMessages,
  parseCriteria,
  runAssessment,
  runGeneration,
  type AssessmentResult,
  type GenerationResult,
  type ReviewCriterion,
} from './ollama/adversarialReview'

const defaultTask = `Create a tiny TypeScript utility package that validates support ticket priority values.

The package should include:
- a function that accepts "low", "normal", "high", or "urgent"
- helpful error messages for invalid input
- a short README showing usage`

const defaultCriteria = `Correctness: The generated files satisfy the stated task and handle invalid input clearly.
Completeness: The sample includes all files needed to understand and use the generated utility.
Security and privacy: The output does not include secrets, real customer data, or unsafe practices.
Maintainability: The code is small, readable, typed, and easy to change.
Documentation: The README explains the behavior and gives a realistic usage example.`

const modelOptions = ['qwen2.5:7b', 'qwen2.5:14b', 'qwen2.5:3b']

type Step = 'idle' | 'generating' | 'assessing'

function PromptPreview({
  task,
  criteria,
  generation,
}: {
  task: string
  criteria: ReviewCriterion[]
  generation: GenerationResult | null
}) {
  const generatorPrompt = useMemo(
    () => buildGeneratorMessages(task, criteria).map((message) => `${message.role.toUpperCase()}\n${message.content}`),
    [criteria, task],
  )
  const assessorPrompt = useMemo(() => {
    if (!generation) return []

    return buildAssessmentMessages({ task, criteria, generation }).map(
      (message) => `${message.role.toUpperCase()}\n${message.content}`,
    )
  }, [criteria, generation, task])

  return (
    <section className="panel prompt-panel">
      <h2>Prompts sent to Ollama</h2>
      <details open>
        <summary>Generator prompt</summary>
        <pre>{generatorPrompt.join('\n\n---\n\n')}</pre>
      </details>
      <details>
        <summary>Adversarial assessor prompt</summary>
        {generation ? (
          <pre>{assessorPrompt.join('\n\n---\n\n')}</pre>
        ) : (
          <p className="muted">Generate files first to preview the assessor prompt.</p>
        )}
      </details>
    </section>
  )
}

function GeneratedFiles({ generation }: { generation: GenerationResult | null }) {
  return (
    <section className="panel files-panel">
      <div className="panel-heading">
        <h2>Generated files</h2>
        <span>{generation ? `${generation.files.length} virtual file(s)` : 'Waiting'}</span>
      </div>
      {generation ? (
        <>
          <p>{generation.summary}</p>
          <div className="file-list">
            {generation.files.map((file) => (
              <article className="file-card" key={file.path}>
                <div className="file-heading">
                  <h3>{file.path}</h3>
                  <span>{file.purpose}</span>
                </div>
                <pre>{file.content}</pre>
              </article>
            ))}
          </div>
        </>
      ) : (
        <p className="muted">Run the generator to create a virtual file set.</p>
      )}
    </section>
  )
}

function Assessment({ assessment }: { assessment: AssessmentResult | null }) {
  return (
    <section className="panel assessment-panel">
      <div className="panel-heading">
        <h2>Adversarial assessment</h2>
        {assessment && <span className={assessment.passed ? 'pass' : 'fail'}>{assessment.passed ? 'Pass' : 'Needs work'}</span>}
      </div>
      {assessment ? (
        <>
          <div className="score-row">
            <strong>{assessment.overallScore}/100</strong>
            <span>{assessment.summary}</span>
          </div>
          <h3>Strengths</h3>
          <ul>
            {assessment.strengths.map((strength) => (
              <li key={strength}>{strength}</li>
            ))}
          </ul>
          <h3>Issues</h3>
          {assessment.issues.length > 0 ? (
            <div className="issue-list">
              {assessment.issues.map((issue) => (
                <article className={`issue ${issue.severity}`} key={`${issue.file}-${issue.criterion}-${issue.problem}`}>
                  <div>
                    <strong>{issue.severity}</strong>
                    <span>{issue.criterion}</span>
                  </div>
                  <p>
                    <code>{issue.file}</code> - {issue.problem}
                  </p>
                  <p className="muted">Suggested fix: {issue.suggestedFix}</p>
                </article>
              ))}
            </div>
          ) : (
            <p className="muted">No issues reported by the assessor.</p>
          )}
        </>
      ) : (
        <p className="muted">Run the assessor after generation to see a rubric-based critique.</p>
      )}
    </section>
  )
}

export default function App() {
  const [baseUrl, setBaseUrl] = useState('http://localhost:11434')
  const [model, setModel] = useState(modelOptions[0])
  const [task, setTask] = useState(defaultTask)
  const [criteriaText, setCriteriaText] = useState(defaultCriteria)
  const [generation, setGeneration] = useState<GenerationResult | null>(null)
  const [assessment, setAssessment] = useState<AssessmentResult | null>(null)
  const [step, setStep] = useState<Step>('idle')
  const [error, setError] = useState<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const criteria = useMemo(() => {
    try {
      return parseCriteria(criteriaText)
    } catch {
      return []
    }
  }, [criteriaText])

  const startRequest = () => {
    abortControllerRef.current?.abort()
    abortControllerRef.current = new AbortController()
    setError(null)

    return abortControllerRef.current.signal
  }

  const finishRequest = () => {
    abortControllerRef.current = null
    setStep('idle')
  }

  const handleError = (requestError: unknown) => {
    if (requestError instanceof DOMException && requestError.name === 'AbortError') {
      setError('Request cancelled.')
      return
    }

    setError(requestError instanceof Error ? requestError.message : 'Unknown Ollama error')
  }

  const handleGenerate = async () => {
    const parsedCriteria = parseCriteria(criteriaText)
    setStep('generating')
    setAssessment(null)

    try {
      const nextGeneration = await runGeneration({
        baseUrl,
        model,
        task,
        criteria: parsedCriteria,
        signal: startRequest(),
      })
      setGeneration(nextGeneration)
    } catch (requestError) {
      handleError(requestError)
    } finally {
      finishRequest()
    }
  }

  const handleAssess = async (generationToAssess = generation) => {
    if (!generationToAssess) {
      setError('Generate files before running the adversarial assessor.')
      return
    }

    const parsedCriteria = parseCriteria(criteriaText)
    setStep('assessing')

    try {
      const nextAssessment = await runAssessment({
        baseUrl,
        model,
        task,
        criteria: parsedCriteria,
        generation: generationToAssess,
        signal: startRequest(),
      })
      setAssessment(nextAssessment)
    } catch (requestError) {
      handleError(requestError)
    } finally {
      finishRequest()
    }
  }

  const handleRunFullLoop = async () => {
    const parsedCriteria = parseCriteria(criteriaText)
    setGeneration(null)
    setAssessment(null)

    try {
      setStep('generating')
      const signal = startRequest()
      const nextGeneration = await runGeneration({
        baseUrl,
        model,
        task,
        criteria: parsedCriteria,
        signal,
      })
      setGeneration(nextGeneration)

      setStep('assessing')
      const nextAssessment = await runAssessment({
        baseUrl,
        model,
        task,
        criteria: parsedCriteria,
        generation: nextGeneration,
        signal,
      })
      setAssessment(nextAssessment)
    } catch (requestError) {
      handleError(requestError)
    } finally {
      finishRequest()
    }
  }

  const handleStop = () => {
    abortControllerRef.current?.abort()
  }

  const isRunning = step !== 'idle'

  return (
    <div className="app">
      <header className="hero">
        <p className="eyebrow">Ollama + Qwen multi-pass sample</p>
        <h1>Generator plus adversarial assessor</h1>
        <p>
          One Qwen call creates a virtual file set. A second Qwen call receives the generated files and a
          rubric, then acts as a strict reviewer.
        </p>
      </header>

      <main className="layout">
        <section className="panel controls">
          <h2>Run configuration</h2>
          <label>
            Ollama base URL
            <input value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} />
          </label>
          <label>
            Qwen model
            <select value={model} onChange={(event) => setModel(event.target.value)}>
              {modelOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label>
            Generation task
            <textarea value={task} rows={8} onChange={(event) => setTask(event.target.value)} />
          </label>
          <label>
            Review criteria
            <textarea value={criteriaText} rows={8} onChange={(event) => setCriteriaText(event.target.value)} />
          </label>
          <div className="criteria-list">
            {criteria.map((criterion) => (
              <span key={criterion.name}>{criterion.name}</span>
            ))}
          </div>
          <div className="button-grid">
            <button type="button" onClick={handleRunFullLoop} disabled={isRunning}>
              Run full loop
            </button>
            <button type="button" className="secondary" onClick={handleGenerate} disabled={isRunning}>
              Generate only
            </button>
            <button type="button" className="secondary" onClick={() => void handleAssess()} disabled={isRunning || !generation}>
              Assess current files
            </button>
            <button type="button" className="danger" onClick={handleStop} disabled={!isRunning}>
              Stop
            </button>
          </div>
          {step !== 'idle' && <p className="status">Currently {step}...</p>}
          {error && <p className="error">{error}</p>}
        </section>

        <GeneratedFiles generation={generation} />
        <Assessment assessment={assessment} />
        <PromptPreview task={task} criteria={criteria} generation={generation} />
      </main>
    </div>
  )
}
