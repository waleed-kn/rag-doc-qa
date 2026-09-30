# RAG Document Q&A

A zero-cost Retrieval-Augmented Generation (RAG) app. Upload documents, ask questions in plain language, and get answers that cite the exact source. Built the proper engineering way: requirements first, then design, then code.

> **Status:** work in progress. The ingestion pipeline (upload, chunk, embed, store) is built. Question answering with Groq and the UI are next. See the [roadmap](#roadmap).

## Why this project

Keyword search fails when the wording differs, and general chatbots invent answers that are not in your document. This app answers **only from your uploaded content**, shows where each answer came from, and says so when the answer is not there.

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
        S --> P[Top chunks + question]
        P --> G[Groq writes answer]
        G --> R[Answer + citations]
    end
```

| Part | Job |
|------|-----|
| Next.js | App and API routes |
| Gemini `gemini-embedding-001` | Turns text into 768-number vectors (finds) |
| Neon Postgres + pgvector | Stores chunks and vectors, runs similarity search (remembers) |
| Groq | Writes the final answer from retrieved chunks (writes) |

## Tech stack

- **App:** Next.js (App Router), TypeScript
- **Database:** Neon Postgres with pgvector (HNSW index, cosine distance)
- **Embeddings:** Gemini, 768 dimensions
- **LLM:** Groq free tier
- **PDF parsing:** unpdf
- **Cost:** $0, free tiers only

## Key design decisions

- **Resumable ingestion.** Chunks are saved first, then embedded in small batches. A failed batch is safe to retry, and it fits serverless time limits and API rate limits.
- **Chunking per page.** A chunk never crosses a page boundary, so page citations stay accurate.
- **One embedding config.** The model setting, the database column, and the config file all use 768 dimensions. `/api/health` checks that they match.
- **Provider interfaces.** Embedding and LLM providers sit behind interfaces, so swapping them means changing one file.
- **Citations from the database.** Sources come from stored rows, not from the LLM, so the model cannot invent a source.

Full details are in [`docs/01-requirements.md`](docs/01-requirements.md) and [`docs/02-system-design.md`](docs/02-system-design.md).

## Getting started

### Prerequisites

- Node.js 20.6 or newer
- A free [Neon](https://neon.tech) database
- A free [Gemini API key](https://aistudio.google.com)

### Setup

```bash
git clone https://github.com/YOUR-USERNAME/rag-doc-qa.git
cd rag-doc-qa
npm install
```

Copy `.env.example` to `.env.local` and fill in your values:

```bash
DATABASE_URL=postgresql://user:password@your-host.neon.tech/neondb?sslmode=require
GEMINI_API_KEY=your_gemini_key_here
```

Create the database tables:

```bash
npm run migrate
```

Start the app:

```bash
npm run dev
```

Check that everything is connected by opening `http://localhost:3000/api/health`. You should see:

```json
{"status":"ok","dbDimension":768,"configDimension":768}
```

### Try the ingestion pipeline

With the dev server running, in a second terminal:

```bash
npm run ingest:test -- ./sample.pdf
```

It uploads the file, then calls the process endpoint until every chunk is embedded.

## API

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/documents` | Upload a file, create chunks |
| POST | `/api/documents/:id/process` | Embed the next batch of chunks |
| GET | `/api/documents` | List documents |
| DELETE | `/api/documents/:id` | Delete a document and its chunks |
| GET | `/api/health` | Check database and dimension config |
| POST | `/api/ask` | Ask a question *(coming next)* |

## Limits

- Upload size: 4 MB per file (serverless request body limit)
- Supported files: PDF, TXT, MD
- Scanned PDFs (images without text) are not supported yet
- Groq free-tier rate limits apply, so heavy use may need to wait

## Roadmap

- [x] Requirements and system design
- [x] Database schema and migration
- [x] Upload, parsing, and per-page chunking
- [x] Resumable embedding with retry and backoff
- [ ] Retrieval and answering with citations (Groq)
- [ ] "Not found" handling with a similarity threshold
- [ ] Chat UI
- [ ] Evaluation set (20 answerable and 5 unanswerable questions)
- [ ] Tests, Docker, and CI with GitHub Actions
- [ ] Public deployment on Vercel

## Project structure

```text
rag-doc-qa/
├── docs/               # requirements and system design
├── migrations/         # SQL migrations
├── scripts/            # migrate and ingest-test scripts
└── src/
    ├── app/api/        # route handlers
    └── lib/            # config, db, parsing, chunking, embeddings, retry, errors
```

## License

MIT