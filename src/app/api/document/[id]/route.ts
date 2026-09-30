import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { AppError, assertUuid, errorResponse } from "@/lib/errors";

export const runtime = "nodejs";

export async function DELETE(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        assertUuid(id);

        const res = await getPool().query("DELETE FROM documents WHERE id = $1", [
            id,
        ]);
        if (res.rowCount === 0) {
            throw new AppError("NOT_FOUND", "Document not found.", 404);
        }
        return new NextResponse(null, { status: 204 });
    } catch (err) {
        return errorResponse(err);
    }
}