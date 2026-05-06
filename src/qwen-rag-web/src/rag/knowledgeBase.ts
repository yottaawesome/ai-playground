export interface KnowledgeChunk {
  id: string
  title: string
  source: string
  content: string
}

export const knowledgeBase: KnowledgeChunk[] = [
  {
    id: 'handbook-setup',
    title: 'Acme Support Handbook: Local setup',
    source: 'mock-docs\\support-handbook.md',
    content:
      'The Acme Support Portal runs locally at http://localhost:5175. Developers should install Node.js 24 or newer, run npm install from the portal folder, and start the app with npm run dev. The portal expects the Acme API to run at http://localhost:7071 during local development.',
  },
  {
    id: 'handbook-login',
    title: 'Acme Support Handbook: Login troubleshooting',
    source: 'mock-docs\\support-handbook.md',
    content:
      'If a support agent cannot sign in, first confirm the account is enabled in the Admin Console. Next, clear the browser session storage and retry. If sign-in still fails, rotate the local development token by running npm run token:refresh from the API folder.',
  },
  {
    id: 'handbook-escalation',
    title: 'Acme Support Handbook: Escalation policy',
    source: 'mock-docs\\support-handbook.md',
    content:
      'Critical production incidents must be escalated to the on-call engineer within 15 minutes. Billing data loss, authentication outages, and customer-visible security issues are always critical. Cosmetic UI bugs should be handled through the normal backlog.',
  },
  {
    id: 'release-notes-42',
    title: 'Acme Portal release 4.2 notes',
    source: 'mock-docs\\release-notes-4.2.md',
    content:
      'Release 4.2 added saved reply templates, improved ticket search ranking, and a new dark mode. The release also changed the default ticket page size from 25 to 50 rows. The old advanced-search endpoint was removed and replaced by POST /api/search/tickets.',
  },
  {
    id: 'release-notes-43',
    title: 'Acme Portal release 4.3 notes',
    source: 'mock-docs\\release-notes-4.3.md',
    content:
      'Release 4.3 introduced a customer health panel that summarizes open incidents, renewal risk, and recent support sentiment. It also added CSV export for filtered ticket lists. CSV export is limited to 10,000 rows per request.',
  },
  {
    id: 'api-search',
    title: 'Acme API: Ticket search',
    source: 'mock-docs\\api-reference.md',
    content:
      'Ticket search uses POST /api/search/tickets with a JSON body containing query, status, priority, and assignedTeam. The endpoint returns items, totalCount, and nextCursor. Clients should pass nextCursor to request the next page of results.',
  },
  {
    id: 'api-rate-limits',
    title: 'Acme API: Rate limits',
    source: 'mock-docs\\api-reference.md',
    content:
      'The Acme API allows 120 requests per minute for local developer tokens and 600 requests per minute for production service tokens. When the limit is exceeded, the API returns HTTP 429 with a retryAfterSeconds field in the response body.',
  },
  {
    id: 'architecture-rag',
    title: 'Architecture note: RAG assistant',
    source: 'mock-docs\\architecture.md',
    content:
      'The Acme assistant uses retrieval augmented generation for support answers. The app searches handbook pages, release notes, and API docs, selects the most relevant chunks, then sends those chunks plus the user question to the language model. The model is instructed to cite chunk identifiers.',
  },
  {
    id: 'architecture-storage',
    title: 'Architecture note: Data storage',
    source: 'mock-docs\\architecture.md',
    content:
      'Tickets are stored in PostgreSQL. Full text search indexes are refreshed every five minutes in production and on every write in local development. Attachments are stored separately in object storage and are referenced by attachmentId.',
  },
  {
    id: 'runbook-cors',
    title: 'Local runbook: Browser CORS',
    source: 'mock-docs\\local-runbook.md',
    content:
      'When a browser app calls a local service, the service must allow the browser origin. For Ollama, set OLLAMA_ORIGINS to the Vite origin, such as http://localhost:3001, before running ollama serve.',
  },
]
