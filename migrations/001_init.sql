CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS documents (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filename    TEXT        NOT NULL,
    file_type   TEXT        NOT NULL CHECK (file_type IN ('pdf', 'txt', 'md')),
    size_bytes  INTEGER     NOT NULL,
    page_count  INTEGER,
    chunk_count INTEGER     NOT NULL DEFAULT 0,
    status      TEXT        NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'processing', 'ready', 'failed')),
    error       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chunks (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id  UUID        NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    chunk_index  INTEGER     NOT NULL,
    page_number  INTEGER,
    content      TEXT        NOT NULL,
    token_count  INTEGER,
    embedding    VECTOR(768),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (document_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS chunks_document_id_idx ON chunks (document_id);

CREATE INDEX IF NOT EXISTS chunks_embedding_idx
    ON chunks USING hnsw (embedding vector_cosine_ops);

CREATE TABLE IF NOT EXISTS query_log (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question          TEXT        NOT NULL,
    model             TEXT,
    retrieved_count   INTEGER,
    top_score         REAL,
    answered          BOOLEAN     NOT NULL,
    prompt_tokens     INTEGER,
    completion_tokens INTEGER,
    latency_ms        INTEGER,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);