import { getPool } from "./db";

interface QueryLogEntry {
    question: string;
    model: string | null;
    retrievedCount: number;
    topScore: number | null;
    answered: boolean;
    promptTokens: number | null;
    completionTokens: number | null;
    latencyMs: number;
}

// Logging must never break an answer, so errors are only printed.
export async function logQuery(entry: QueryLogEntry) {
    try {
        await getPool().query(
            `INSERT INTO query_log
         (question, model, retrieved_count, top_score, answered,
          prompt_tokens, completion_tokens, latency_ms)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
                entry.question,
                entry.model,
                entry.retrievedCount,
                entry.topScore,
                entry.answered,
                entry.promptTokens,
                entry.completionTokens,
                entry.latencyMs,
            ]
        );
    } catch (err) {
        console.error("query_log insert failed", err);
    }
}