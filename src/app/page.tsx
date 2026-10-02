"use client";

import { useState } from "react";
import Chat from "@/components/Chat";
import UploadPanel from "@/components/UploadPanel";
import type { DocumentItem } from "@/lib/api-client";

export default function Home() {
  const [docs, setDocs] = useState<DocumentItem[]>([]);
  const readyCount = docs.filter((d) => d.status === "ready").length;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">RAG Document Q&amp;A</h1>
        <p className="text-sm text-neutral-500">
          Upload documents, then ask questions. Every answer shows its sources.
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-1">
          <UploadPanel onDocumentsChange={setDocs} />
        </div>
        <div className="md:col-span-2">
          <Chat disabled={readyCount === 0} />
        </div>
      </div>
    </main>
  );
}
