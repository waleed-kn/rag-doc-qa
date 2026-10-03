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

const STATUS_LABEL: Record<DocumentItem["status"], string> = {
  ready: "Ready",
  processing: "Processing",
  pending: "Waiting",
  failed: "Failed",
};

interface Props {
  onDocumentsChange: (docs: DocumentItem[]) => void;
}

export default function UploadPanel({ onDocumentsChange }: Props) {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [busyLabel, setBusyLabel] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const busy = busyLabel !== null;
  const pct =
    progress && progress.total > 0
      ? Math.round((progress.done / progress.total) * 100)
      : 0;

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
    setBusyLabel(`Preparing ${name}`);
    setProgress({ done: 0, total });
    await embedAll(documentId, total, (done, t) => setProgress({ done, total: t }));
  }

  async function run(task: () => Promise<void>) {
    setError(null);
    setConfirmId(null);
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
      setError("Only PDF, TXT, and Markdown files are supported.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("This file is over 4 MB. Choose a smaller file.");
      return;
    }
    void run(async () => {
      setBusyLabel(`Uploading ${file.name}`);
      const created = await uploadDocument(file);
      await embed(created.documentId, created.totalChunks, file.name);
    });
  }

  function resume(doc: DocumentItem) {
    void run(() => embed(doc.id, doc.chunkCount, doc.filename));
  }

  function confirmRemove(doc: DocumentItem) {
    void run(() => deleteDocument(doc.id));
  }

  function openPicker() {
    if (!busy) fileInput.current?.click();
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <h2 className="panel-title">Documents</h2>
        <p className="panel-sub">Add the files you want to ask about.</p>
      </div>

      <input
        ref={fileInput}
        type="file"
        accept=".pdf,.txt,.md"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) handleFile(file);
        }}
      />

      <div
        className={`dropzone${dragging ? " is-dragging" : ""}${busy ? " is-disabled" : ""}`}
        role="button"
        tabIndex={busy ? -1 : 0}
        aria-disabled={busy}
        onClick={openPicker}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openPicker();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!busy) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file && !busy) handleFile(file);
        }}
      >
        <svg
          className="dropzone-icon"
          width="26"
          height="26"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 16V4" />
          <path d="m7 9 5-5 5 5" />
          <path d="M5 20h14" />
        </svg>
        <p className="dropzone-title">Drop a file here or browse</p>
        <p className="dropzone-hint">
          PDF, TXT, or Markdown, up to 4 MB. Scanned PDFs aren&apos;t supported.
        </p>
      </div>

      {busy && (
        <div className="progress" role="status" aria-live="polite">
          <div className="progress-label">
            <span>{busyLabel}</span>
            {progress && (
              <span>
                {progress.done} of {progress.total} sections
              </span>
            )}
          </div>
          {progress && (
            <div
              className="progress-track"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={pct}
            >
              <div className="progress-fill" style={{ width: `${pct}%` }} />
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}

      {documents.length === 0 ? (
        <p className="empty-list">No documents yet.</p>
      ) : (
        <ul className="doc-list">
          {documents.map((doc) => {
            const pages = doc.pageCount ?? 1;
            return (
              <li key={doc.id} className="doc">
                <p className="doc-name" title={doc.filename}>
                  {doc.filename}
                </p>
                <p className="doc-meta">
                  {pages} {pages === 1 ? "page" : "pages"}, {doc.chunkCount} sections
                </p>
                <div className="doc-row">
                  <span className={`status status-${doc.status}`}>
                    <span className="dot" aria-hidden="true" />
                    {STATUS_LABEL[doc.status]}
                  </span>

                  {confirmId === doc.id ? (
                    <span className="doc-actions">
                      <span className="confirm-text">Delete this file?</span>
                      <button
                        type="button"
                        className="link-btn link-btn-danger"
                        onClick={() => confirmRemove(doc)}
                        disabled={busy}
                      >
                        Yes, delete
                      </button>
                      <button
                        type="button"
                        className="link-btn"
                        onClick={() => setConfirmId(null)}
                      >
                        Keep
                      </button>
                    </span>
                  ) : (
                    <span className="doc-actions">
                      {doc.status !== "ready" && (
                        <button
                          type="button"
                          className="link-btn"
                          onClick={() => resume(doc)}
                          disabled={busy}
                        >
                          Resume
                        </button>
                      )}
                      <button
                        type="button"
                        className="link-btn"
                        onClick={() => setConfirmId(doc.id)}
                        disabled={busy}
                      >
                        Delete
                      </button>
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}