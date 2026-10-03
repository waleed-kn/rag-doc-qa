import { NextRequest, NextResponse } from "next/server";
import { config } from "@/lib/config";
import { getPool } from "@/lib/db";
import { AppError, errorResponse } from "@/lib/errors";
import { parseFile } from "@/lib/parsing";
import { chunkPages } from "@/lib/chunking";
import { limitUpload } from "@/lib/rate-limit";

export const runtime = "nodejs";

// Upload a file, split it into chunks, store them (no embeddings yet).
export async function POST(req: NextRequest) {
  try {
    await limitUpload(req);

    const form = await req.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      throw new AppError(
        "INVALID_REQUEST",
        "Attach a file in the 'file' field.",
        400
      );
    }
    if (file.size > config.upload.maxBytes) {
      throw new AppError(
        "FILE_TOO_LARGE",
        `File is too large. Maximum is ${config.upload.maxBytes / 1024 / 1024} MB.`,
        413
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = await parseFile(file.name, buffer);
    const chunks = chunkPages(parsed.pages, config.chunking);

    if (chunks.length === 0) {
      throw new AppError("NO_TEXT_FOUND", "No readable text found.", 422);
    }

    const client = await getPool().connect();
    try {
      await client.query("BEGIN");

      const doc = await client.query(
        `INSERT INTO documents
           (filename, file_type, size_bytes, page_count, chunk_count, status)
         VALUES ($1, $2, $3, $4, $5, 'processing')
         RETURNING id`,
        [file.name, parsed.fileType, file.size, parsed.pages.length, chunks.length]
      );
      const documentId: string = doc.rows[0].id;

      await client.query(
        `INSERT INTO chunks
           (document_id, chunk_index, page_number, content, token_count)
         SELECT $1::uuid, t.chunk_index, t.page_number, t.content, t.token_count
         FROM unnest($2::int[], $3::int[], $4::text[], $5::int[])
           AS t(chunk_index, page_number, content, token_count)`,
        [
          documentId,
          chunks.map((c) => c.chunkIndex),
          chunks.map((c) => c.pageNumber),
          chunks.map((c) => c.content),
          chunks.map((c) => c.tokenCount),
        ]
      );

      await client.query("COMMIT");

      return NextResponse.json(
        {
          documentId,
          filename: file.name,
          totalChunks: chunks.length,
          status: "processing",
        },
        { status: 201 }
      );
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    return errorResponse(err);
  }
}

// List all documents.
export async function GET() {
  try {
    const res = await getPool().query(
      `SELECT id,
              filename,
              file_type   AS "fileType",
              page_count  AS "pageCount",
              chunk_count AS "chunkCount",
              status,
              created_at  AS "createdAt"
       FROM documents
       ORDER BY created_at DESC`
    );
    return NextResponse.json({ documents: res.rows });
  } catch (err) {
    return errorResponse(err);
  }
}
