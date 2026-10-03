# RAG Document Q&A

![CI](https://github.com/waleed-kn/rag-doc-qa/actions/workflows/ci.yml/badge.svg)

Upload documents, ask questions in plain language, and get answers with **page-level citations**. If the answer is not in your documents, the app says so instead of guessing. Built the engineering way: requirements, design, code, tests, CI, Docker, and deployment, all on free tiers.

**Live demo:** https://YOUR-LIVE-URL

![Answer with sources](docs/images/answer.png)
![Not found](docs/images/not-found.png)

## Features

- Upload PDF, TXT, or MD files (up to 4 MB)
- Semantic search by meaning, not keywords
- Answers written only from your documents, with filename, page, and excerpt for every source
- Refuses questions that are not covered, before spending any LLM tokens
- Progress bar for embedding, with resume for interrupted uploads
- Rate limiting, tests, CI, and a Docker image build

## How it works

RAG is an open-book exam: find the right pages, read them, then write the answer.

```mermaid
flowchart LR
    subgraph Ingestion
        A[Upload file] --> B[Extract text per page]
        B --> C[Split into chunks]
        C --> D[Embed with Gemini]
        D --> E[(Neon Postgres + pgvector)]
    end
    subgraph Question answering
        Q[Question] --> QE[Embed question]
        QE --> S[Similarity search]
        E --> S
        S --> T{Score above threshold?}
        T -- no --> N[Not found]
        T -- yes --> P[Top chunks + question]
        P --> G[Groq writes answer]
        G --> R[Answer + citations]
    end
```

| Part | Job |
|------|-----|
| Next.js + TypeScript | UI and API routes |
| Gemini `gemini-embedding-001` (768 dimensions) | Turns text into vectors (finds) |
| Neon Postgres + pgvector (HNSW, cosine) | Stores chunks and vectors, runs similarity search (remembers) |
| Groq | Writes the answer from the retrieved chunks only (writes) |

## Evaluation

Measured with a hand-checked question set (`eval/questions.json`) run by `npm run eval`.

| Metric | Result | Target |
|--------|--------|--------|
| Answerable questions answered correctly and cited | [X]/[N] ([X]%) | 80% |
| Out-of-scope questions correctly refused | [Y]/[M] ([Y]%) | 80% |
| Average latency | [Z]s | |

The eval also picks the similarity threshold. My first run scored 0% on citations because the model ignored the citation format. A stricter prompt fixed it, and I only found the problem because I measured.

## Key design decisions

- **Resumable ingestion.** Chunks are saved first, then embedded in small batches. A failed batch is safe to retry, which respects API rate limits and serverless time limits.
- **Chunking per page.** A chunk never crosses a page boundary, so citations point to the right page.
- **One embedding config.** The model setting, the database column, and the config file all use 768 dimensions. A unit test and the `/api/health` endpoint both check that they match.
- **Two-layer "not found".** A similarity threshold refuses before calling the LLM, which also saves tokens. A prompt rule is the backup.
- **Citations from the database.** Sources come from stored rows, not from the model, so it cannot invent one.
- **Model fallback.** If the first Groq model is rate limited, the second one answers.
- **Provider interfaces.** Embedding and LLM providers sit behind interfaces, so swapping them means editing one file.
- **Postgres-backed rate limiting.** Atomic counters in the existing database, shared across serverless instances, at no extra cost.

## Tech stack

Next.js (App Router), TypeScript, Tailwind, Postgres with pgvector on Neon, Gemini embeddings, Groq, Vitest, GitHub Actions, Docker, Vercel. Everything runs on free tiers.

## Run it locally

Requirements: Node.js 22 or newer, a free [Neon](https://neon.tech) database, a [Gemini API key](https://aistudio.google.com), and a [Groq API key](https://console.groq.com).

```bash
git clone https://github.com/waleed-kn/rag-doc-qa.git
cd rag-doc-qa
npm install
```

Create `.env.local` (never commit it):

```bash
DATABASE_URL=postgresql://user:password@host.neon.tech/dbname?sslmode=require
GEMINI_API_KEY=your_key
GROQ_API_KEY=your_key
RATE_LIMIT_DISABLED=true
```

```bash
npm run migrate   # create the tables
npm run dev       # http://localhost:3000
```

Check `http://localhost:3000/api/health`. You should see `{"status":"ok","dbDimension":768,"configDimension":768}`.

### Useful commands

| Command | Purpose |
|---------|---------|
| `npm test` | Run the unit tests |
| `npm run typecheck` | Type-check with TypeScript |
| `npm run lint` | Lint the code |
| `npm run eval:draft` | Draft evaluation questions from your documents |
| `npm run eval` | Score the app and suggest a similarity threshold |
| `npm run ingest:test -- ./file.pdf` | Ingest a file from the terminal |
| `npm run ask:test -- "question"` | Ask a question from the terminal |

## Quality and automation

- **25+ unit tests** cover chunking, prompt building, retry logic, rate-limit helpers, and config consistency.
- **CI** runs lint, type-check, tests, and a production build on every push, then builds the Docker image.
- **Docker:** multi-stage `Dockerfile` with a small runtime image that runs as a non-root user.

## Rate limits

| Action | Per visitor | Whole app |
|--------|-------------|-----------|
| Ask | 3 per minute, 20 per day | 5 per minute, 100 per day |
| Upload | 5 per hour | |
| Embed | 30 per minute | |

These protect the free-tier quotas of Groq and Gemini.

## API

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/documents` | Upload a file, create chunks |
| POST | `/api/documents/:id/process` | Embed the next batch of chunks |
| GET | `/api/documents` | List documents |
| DELETE | `/api/documents/:id` | Delete a document and its chunks |
| POST | `/api/ask` | Ask a question, get a cited answer |
| GET | `/api/health` | Check the database and the dimension config |

## Known limitations

- No user accounts: visitors share one document pool, and anyone can delete any document. Use only neutral documents in the live demo.
- Scanned PDFs (images without text) are not supported.
- Free-tier limits apply: Groq tokens per day, Gemini rate limits, and a 4 MB upload cap from the platform's request body limit.
- Retrieval uses vector search only. Re-ranking and hybrid keyword search are future work.

## Project structure

```text
rag-doc-qa/
├── docs/            # requirements, system design, screenshots
├── eval/            # question set and scoring script
├── migrations/      # SQL migrations
├── scripts/         # migrate, ingest-test, ask-test
├── tests/           # unit tests
├── src/
│   ├── app/api/     # route handlers
│   ├── components/  # upload panel and chat
│   └── lib/         # config, db, parsing, chunking, embeddings, llm, retrieval, rate limiting
├── Dockerfile
└── .github/workflows/ci.yml
```

## Documentation

- [Requirements](docs/01-requirements.md)
- [System design](docs/02-system-design.md)

## License

MIT