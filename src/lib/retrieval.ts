import { config } from "./config";
import { getPool, toVectorLiteral } from "./db";
import { getEmbeddingProvider } from "./embeddings";

export interface RetrievedChunk {
    id: string;
    documentId: string;
    filename: string;
    pageNumber: number | null;
    content: string;
    score: number;
}

// Embed the question, then find the closest chunks by cosine similarity.
export async function retrieve(question: string): Promise<RetrievedChunk[]> {
    const queryVector = await getEmbeddingProvider().embedQuery(question);

    const res = await getPool().query(
        `SELECT c.id,
            c.document_id AS "documentId",
            d.filename,
            c.page_number AS "pageNumber",
            c.content,
            1 - (c.embedding <=> $1::vector) AS score
     FROM chunks c
     JOIN documents d ON d.id = c.document_id
     WHERE d.status = 'ready' AND c.embedding IS NOT NULL
     ORDER BY c.embedding <=> $1::vector
     LIMIT $2`,
        [toVectorLiteral(queryVector), config.retrieval.topK]
    );

    return res.rows as RetrievedChunk[];
}