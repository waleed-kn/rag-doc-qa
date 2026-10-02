"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ApiError,
  deleteDocument,
  embedAll,
  listDocuments,
  uploadDocument,
  type DocumentItem,
} from "@/lib/api-client";

const MAX_BYTES = 4 * 1024 * 1024;
const ALLOWED = ["pdf", "txt", "md"];

interface Props {
  onDocumentsChange: (docs: DocumentItem[]) => void;
}

const statusStyle: Record<DocumentItem["status"], string> = {
  ready: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  processing: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  pending: "bg-neutral-200 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-200",
  failed: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

export default function UploadPanel({ onDocumentsChange }: Props) {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [busyLabel, setBusyLabel] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    try {
      const docs = await listDocuments();
      setDocuments(docs);
      onDocumentsChange(docs);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load documents.");
    }
  }, [onDocumentsChange]);

  useEffect(() => {
    let cancelled = false;

    listDocuments()
      .then((docs) => {
        if (cancelled) return;
        setDocuments(docs);
        onDocumentsChange(docs);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          err instanceof ApiError ? err.message : "Could not load documents."
        );
      });

    return () => {
      cancelled = true;
    };
  }, [onDocumentsChange]);
  async function embed(documentId: string, total: number, name: string) {
    setBusyLabel(`Embedding ${name}...`);
    setProgress({ done: 0, total });
    await embedAll(documentId, total, (done, t) => setProgress({ done, total: t }));
  }

  async function run(task: () => Promise<void>) {
    setError(null);
    try {
      await task();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setBusyLabel(null);
      setProgress(null);
      await refresh();
    }
  }

  function handleFile(file: File) {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!ALLOWED.includes(ext)) {
      setError("Only PDF, TXT, and MD files are supported.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("File is too large. Maximum is 4 MB.");
      return;
    }
    void run(async () => {
      setBusyLabel(`Uploading ${file.name}...`);
      const created = await uploadDocument(file);
      await embed(created.documentId, created.totalChunks, file.name);
    });
  }

  function resume(doc: DocumentItem) {
    void run(() => embed(doc.id, doc.chunkCount, doc.filename));
  }

  function remove(doc: DocumentItem) {
    if (!window.confirm(`Delete "${doc.filename}"?`)) return;
    void run(() => deleteDocument(doc.id));
  }

  const busy = busyLabel !== null;
  const pct = progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <section className="rounded-xl border border-neutral-300 p-4 dark:border-neutral-700">
      <h2 className="mb-3 text-lg font-semibold">Documents</h2>

      <input
        ref={fileInput}
        type="file"
        accept=".pdf,.txt,.md"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) handleFile(file);
        }}
      />
      <button
        onClick={() => fileInput.current?.click()}
        disabled={busy}
        className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        Upload PDF, TXT, or MD
      </button>
      <p className="mt-1 text-xs text-neutral-500">Max 4 MB. Scanned PDFs are not supported.</p>

      {busy && (
        <div className="mt-3">
          <p className="text-sm">{busyLabel}</p>
          {progress && (
            <>
              <div className="mt-1 h-2 w-full overflow-hidden rounded bg-neutral-200 dark:bg-neutral-700">
                <div className="h-full bg-blue-600 transition-all" style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-1 text-xs text-neutral-500">
                {progress.done} of {progress.total} chunks
              </p>
            </>
          )}
        </div>
      )}

      {error && (
        <p className="mt-3 rounded bg-red-50 p-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      <ul className="mt-4 space-y-2">
        {documents.length === 0 && (
          <li className="text-sm text-neutral-500">No documents yet.</li>
        )}
        {documents.map((doc) => (
          <li key={doc.id} className="rounded-lg border border-neutral-200 p-2 text-sm dark:border-neutral-700">
            <p className="truncate font-medium" title={doc.filename}>{doc.filename}</p>
            <p className="text-xs text-neutral-500">
              {doc.pageCount ?? 1} page(s) · {doc.chunkCount} chunks
            </p>
            <div className="mt-2 flex items-center gap-2">
              <span className={`rounded px-2 py-0.5 text-xs ${statusStyle[doc.status]}`}>{doc.status}</span>
              {doc.status !== "ready" && (
                <button
                  onClick={() => resume(doc)}
                  disabled={busy}
                  className="text-xs text-blue-600 hover:underline disabled:opacity-50"
                >
                  Resume
                </button>
              )}
              <button
                onClick={() => remove(doc)}
                disabled={busy}
                className="ml-auto text-xs text-red-600 hover:underline disabled:opacity-50"
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
