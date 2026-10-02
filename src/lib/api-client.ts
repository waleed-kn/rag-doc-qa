export interface DocumentItem {
  id: string;
  filename: string;
  fileType: string;
  pageCount: number | null;
  chunkCount: number;
  status: "pending" | "processing" | "ready" | "failed";
  createdAt: string;
}

export interface Source {
  index: number;
  documentId: string;
  filename: string;
  page: number | null;
  score: number;
  cited: boolean;
  excerpt: string;
}

export interface AskResponse {
  answer: string;
  answered: boolean;
  sources: Source[];
  topScore: number | null;
  model: string | null;
}

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number
  ) {
    super(message);
  }
}

type ErrorBody = { error?: { code?: string; message?: string } };

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (res.status === 204) return undefined as T;

  const text = await res.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new ApiError(
      "BAD_RESPONSE",
      "Unexpected response from the server.",
      res.status
    );
  }

  if (!res.ok) {
    const body = data as ErrorBody;
    throw new ApiError(
      body.error?.code ?? "ERROR",
      body.error?.message ?? "Request failed.",
      res.status
    );
  }
  return data as T;
}

export async function listDocuments(): Promise<DocumentItem[]> {
  const data = await request<{ documents: DocumentItem[] }>("/api/documents");
  return data.documents;
}

export function uploadDocument(file: File) {
  const form = new FormData();
  form.append("file", file);
  return request<{ documentId: string; filename: string; totalChunks: number }>(
    "/api/documents",
    { method: "POST", body: form }
  );
}

export function processDocument(id: string) {
  return request<{ processed: number; remaining: number; status: string }>(
    `/api/documents/${id}/process`,
    { method: "POST" }
  );
}

export function deleteDocument(id: string) {
  return request<void>(`/api/documents/${id}`, { method: "DELETE" });
}

export function askQuestion(question: string) {
  return request<AskResponse>("/api/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Calls /process until every chunk is embedded. Retries when the
// embedding service is busy (HTTP 503).
export async function embedAll(
  documentId: string,
  total: number,
  onProgress: (done: number, total: number) => void
) {
  let busyRetries = 0;
  for (;;) {
    try {
      const r = await processDocument(documentId);
      busyRetries = 0;
      onProgress(Math.max(0, total - r.remaining), total);
      if (r.remaining === 0) return;
    } catch (err) {
      if (err instanceof ApiError && err.status === 503 && busyRetries < 5) {
        busyRetries++;
        await sleep(5000);
        continue;
      }
      throw err;
    }
  }
}
