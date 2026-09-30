import { extractText, getDocumentProxy } from "unpdf";
import { AppError } from "./errors";
import { config } from "./config";

export interface PageText {
    pageNumber: number;
    text: string;
}

export interface ParsedFile {
    fileType: "pdf" | "txt" | "md";
    pages: PageText[];
}

// Postgres text columns cannot contain null bytes, and PDFs sometimes do.
const clean = (s: string) => s.replace(/\u0000/g, "").trim();

export async function parseFile(
    filename: string,
    buffer: Buffer
): Promise<ParsedFile> {
    const ext = filename.split(".").pop()?.toLowerCase() ?? "";

    if (!config.upload.allowedExtensions.includes(ext)) {
        throw new AppError(
            "INVALID_FILE_TYPE",
            "Only PDF, TXT, and MD files are supported.",
            400
        );
    }

    let pages: PageText[];

    if (ext === "pdf") {
        const pdf = await getDocumentProxy(new Uint8Array(buffer));
        const { text } = await extractText(pdf, { mergePages: false });
        pages = (text as string[]).map((t, i) => ({
            pageNumber: i + 1,
            text: clean(t),
        }));
    } else {
        pages = [{ pageNumber: 1, text: clean(buffer.toString("utf8")) }];
    }

    pages = pages.filter((p) => p.text.length > 0);

    if (pages.length === 0) {
        throw new AppError(
            "NO_TEXT_FOUND",
            "No readable text found. Scanned PDFs are not supported yet.",
            422
        );
    }

    return { fileType: ext as ParsedFile["fileType"], pages };
}