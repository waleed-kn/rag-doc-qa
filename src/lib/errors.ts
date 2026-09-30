import { NextResponse } from "next/server";

export class AppError extends Error {
    constructor(
        public code: string,
        message: string,
        public status: number
    ) {
        super(message);
    }
}

export function errorResponse(err: unknown) {
    if (err instanceof AppError) {
        return NextResponse.json(
            { error: { code: err.code, message: err.message } },
            { status: err.status }
        );
    }
    console.error(err);
    return NextResponse.json(
        { error: { code: "INTERNAL_ERROR", message: "Something went wrong." } },
        { status: 500 }
    );
}

const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function assertUuid(id: string) {
    if (!UUID_RE.test(id)) {
        throw new AppError("NOT_FOUND", "Document not found.", 404);
    }
}