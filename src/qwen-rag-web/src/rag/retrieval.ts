import { knowledgeBase, type KnowledgeChunk } from './knowledgeBase'

export interface RetrievedChunk extends KnowledgeChunk {
  score: number
}

const stopWords = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'by',
  'for',
  'from',
  'how',
  'i',
  'in',
  'is',
  'it',
  'of',
  'on',
  'or',
  'should',
  'the',
  'this',
  'to',
  'what',
  'when',
  'with',
])

function tokenize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9.:/-]+/g, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 1 && !stopWords.has(token))
}

function scoreChunk(queryTokens: string[], chunk: KnowledgeChunk) {
  const searchableText = `${chunk.title} ${chunk.source} ${chunk.content}`.toLowerCase()
  const chunkTokens = tokenize(searchableText)
  const uniqueQueryTokens = new Set(queryTokens)
  let score = 0

  uniqueQueryTokens.forEach((queryToken) => {
    const exactMatches = chunkTokens.filter((chunkToken) => chunkToken === queryToken).length
    const partialMatches = chunkTokens.filter(
      (chunkToken) => chunkToken.includes(queryToken) && chunkToken !== queryToken,
    ).length

    score += exactMatches * 3
    score += partialMatches

    if (searchableText.includes(queryToken)) {
      score += 1
    }
  })

  return score
}

export function retrieveRelevantChunks(query: string, maxChunks: number): RetrievedChunk[] {
  const queryTokens = tokenize(query)
  if (queryTokens.length === 0) return []

  return knowledgeBase
    .map((chunk) => ({ ...chunk, score: scoreChunk(queryTokens, chunk) }))
    .filter((chunk) => chunk.score > 0)
    .sort((left, right) => right.score - left.score || left.id.localeCompare(right.id))
    .slice(0, maxChunks)
}

export function buildContextBlock(chunks: RetrievedChunk[]) {
  if (chunks.length === 0) {
    return 'No relevant context was retrieved.'
  }

  return chunks
    .map(
      (chunk, index) =>
        `Context ${index + 1} [${chunk.id}]\nTitle: ${chunk.title}\nSource: ${chunk.source}\nContent: ${chunk.content}`,
    )
    .join('\n\n')
}
