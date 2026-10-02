# RAG Document Q&A: Requirements

**Status:** Draft v1
**Project:** rag-doc-qa
**Goal:** Portfolio and learning project built the proper engineering way, at zero cost.

---

## 1. Problem statement

People have long documents (lecture notes, manuals, reports) and waste time searching them by keyword. Keyword search fails when the wording differs, and general chatbots invent answers that are not in the document.

This system lets a user upload documents and ask questions in plain language. It answers using only the uploaded content and shows exactly where each answer came from, so every answer can be verified.

## 2. Users

- **Primary:** a student uploading lecture notes or PDFs to study.
- **Secondary:** a professional querying manuals, policies, or reports.
- **Also:** recruiters and interviewers testing the live demo with their own documents.

## 3. Functional requirements

| ID | Requirement |
|----|-------------|
| FR1 | The user can upload a document (PDF, TXT, or MD). |
| FR2 | The system extracts the text and splits it into chunks (about 300 to 500 words, with overlap). |
| FR3 | The system creates an embedding for each chunk and stores the chunk and its vector in the database. |
| FR4 | The user can ask a question in a chat interface. |
| FR5 | The system retrieves the top 3 to 4 most relevant chunks for the question. |
| FR6 | The system generates an answer using only the retrieved chunks. |
| FR7 | Every answer shows source citations (document name and page or chunk number). |
| FR8 | If the answer is not in the documents, the system says so instead of guessing. |
| FR9 | The user can see a list of uploaded documents and delete one. |
| FR10 | The system shows a friendly message when a rate limit is hit ("try again in a minute"). |

## 4. Non-functional requirements

### Cost
- Total cost must be **$0**, using free tiers only.

### Stack (fixed)
| Part | Choice |
|------|--------|
| App and API | Next.js (TypeScript) on Vercel free tier |
| Database and vectors | Neon Postgres with pgvector |
| Embeddings | Gemini `gemini-embedding-001`, 768 dimensions, cosine similarity |
| Answer LLM | Groq free tier (`openai/gpt-oss-20b`, fallback `qwen/qwen3.8-27b`) |

### Provider limits (design constraints)
- **Groq (per model):** 30 requests per minute, 1K requests per day, 8K tokens per minute, 200K tokens per day.
- **Estimated cost per question:** about 2,800 tokens, so roughly 2 to 3 questions per minute and about 70 per day per model.
- **Gemini embeddings:** limits to be confirmed from Google AI Studio (RPM, RPD, TPM).

### Constraints that drive the design
- Index and query embeddings must use the **same model, same dimension, and matching task types**. Model name and dimension live in one config file only.
- The LLM and embedding providers are swappable through one config file.
- If the primary Groq model is rate limited, fall back to the second model.
- Ingestion must batch chunks and retry with exponential backoff to respect embedding rate limits.
- Retrieve only 3 to 4 chunks per question to stay inside the token budget.

### Performance
- Answer latency: under 8 seconds for a typical question.
- Ingestion: a 20-page PDF processed in under 2 minutes.

### Limits
- Max upload size: 10 MB per file.
- Max documents: capped to fit the Neon free-tier storage.

### Security
- API keys only in environment variables, never in the repository.
- Basic per-IP rate limiting on the question and upload endpoints.
- Validate file type and size on upload.

## 5. Out of scope (v1)

- User accounts and login (v1 is a single-user demo).
- Multi-user document isolation.
- OCR for scanned or image-only PDFs.
- Images, audio, and video.
- Conversation memory across questions (each question is standalone).
- Streaming responses.
- Re-ranking models and hybrid keyword search.
- Payments and any paid service.

## 6. Success criteria

The project is done when all of these hold:

1. On a set of **20 test questions** across 3 documents, at least **80%** of answers are correct and cite the right source.
2. On **5 questions whose answers are not in the documents**, the system declines to answer at least 4 times.
3. Every answer in the test set includes at least one citation.
4. The app is deployed on a public URL at zero cost.
5. Tests run automatically in GitHub Actions on every push.
6. The README explains the architecture, the design decisions, and the evaluation results.

## 7. Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Groq daily token cap reached | Demo stops working | Fallback model, rate limiting, friendly error message |
| Embedding rate limits slow ingestion | Slow uploads | Batching and backoff, file size cap |
| Free-tier terms or limits change | Stack breaks | Provider config file, local fallback (Ollama and Docker Postgres) |
| Poor chunking hurts answer quality | Wrong answers | Evaluation set, tune chunk size and overlap |
| Neon storage fills up | Uploads fail | Document count and size caps, delete feature |

## 8. Build phases

1. Requirements (this document)
2. System design: architecture, data model, API
3. Ingestion pipeline: upload, chunk, embed, store
4. Retrieval and answering with citations
5. Evaluation: measure answer quality on the test set
6. Tests, Docker, CI/CD, deployment
7. README and resume write-up

## 9. Open items

- Confirm the Gemini embedding limits from Google AI Studio.
- Final chunk size and overlap (decide during evaluation).
