import { NextRequest, NextResponse } from "next/server";
import { config } from "@/lib/config";
import { getPool, toVectorLiteral } from "@/lib/db";
import { AppError, assertUuid, errorResponse } from "@/lib/errors";
import { getEmbeddingProvider } from "@/lib/embeddings";

export const runtime = "nodejs";
// Check your Vercel plan's current maximum and adjust batchSize to fit.
export const maxDuration = 60;

// Embeds the next batch of chunks. The client calls this until remaining = 0.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    assertUuid(id);
    const pool = getPool();

    const doc = await pool.query("SELECT id FROM documents WHERE id = $1", [
      id,
    ]);
    if (doc.rowCount === 0) {
      throw new AppError("NOT_FOUND", "Document not found.", 404);
    }

    const pending = await pool.query(
      `SELECT id, content
       FROM chunks
       WHERE document_id = $1 AND embedding IS NULL
       ORDER BY chunk_index
       LIMIT $2`,
      [id, config.ingestion.batchSize]
    );

    let processed = 0;

    if (pending.rows.length > 0) {
      const vectors = await getEmbeddingProvider().embedDocuments(
        pending.rows.map((r) => r.content as string)
      );

      await pool.query(
        `UPDATE chunks c
         SET embedding = v.embedding::vector
         FROM unnest($1::uuid[], $2::text[]) AS v(id, embedding)
         WHERE c.id = v.id`,
        [pending.rows.map((r) => r.id), vectors.map(toVectorLiteral)]
      );
      processed = pending.rows.length;
    }

    const remainingRes = await pool.query(
      `SELECT count(*)::int AS n
       FROM chunks
       WHERE document_id = $1 AND embedding IS NULL`,
      [id]
    );
    const remaining: number = remainingRes.rows[0].n;
    const status = remaining === 0 ? "ready" : "processing";

    await pool.query("UPDATE documents SET status = $2 WHERE id = $1", [
      id,
      status,
    ]);

    return NextResponse.json({ processed, remaining, status });
  } catch (err) {
    return errorResponse(err);
  }
}
