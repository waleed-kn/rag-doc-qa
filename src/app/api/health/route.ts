import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import { getPool } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
    try {
        const pool = getPool();
        await pool.query("SELECT 1");

        // For pgvector columns, atttypmod stores the declared dimension.
        const res = await pool.query(
            `SELECT a.atttypmod AS dim
       FROM pg_attribute a
       WHERE a.attrelid = 'chunks'::regclass AND a.attname = 'embedding'`
        );
        const dbDimension = res.rows[0]?.dim ?? null;
        const ok = dbDimension === config.embedding.dimensions;

        return NextResponse.json(
            {
                status: ok ? "ok" : "dimension_mismatch",
                dbDimension,
                configDimension: config.embedding.dimensions,
            },
            { status: ok ? 200 : 500 }
        );
    } catch (err) {
        console.error(err);
        return NextResponse.json(
            { status: "database_error" },
            { status: 503 }
        );
    }
}