"use client";

import { useCallback, useState } from "react";
import Chat from "@/components/Chat";
import EvidencePanel from "@/components/EvidencePanel";
import UploadPanel from "@/components/UploadPanel";
import type { DocumentItem, Source } from "@/lib/api-client";

interface Evidence {
  sources: Source[];
  active: number | null;
  pulse: number;
}

export default function Home() {
  const [docs, setDocs] = useState<DocumentItem[]>([]);
  const [evidence, setEvidence] = useState<Evidence>({
    sources: [],
    active: null,
    pulse: 0,
  });

  const readyCount = docs.filter((d) => d.status === "ready").length;

  // pulse changes on every call, so the highlight stroke replays each time.
  const showEvidence = useCallback(
    (sources: Source[], active: number | null) => {
      setEvidence((prev) => ({ sources, active, pulse: prev.pulse + 1 }));
    },
    []
  );

  return (
    <div className="shell">
      <a className="skip-link" href="#chat">
        Skip to chat
      </a>

      <header className="topbar">
        <div className="brand">
          <svg
            className="brand-mark"
            width="28"
            height="28"
            viewBox="0 0 28 28"
            aria-hidden="true"
          >
            <rect
              x="5"
              y="3"
              width="18"
              height="22"
              rx="3"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            />
            <rect x="9" y="10" width="10" height="4" rx="1" fill="var(--marker)" />
            <path
              d="M9 7h6M9 18h7"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
          <h1 className="brand-name">Document Q&amp;A</h1>
        </div>

        <p className="topbar-status" aria-live="polite">
          <span
            className={`dot${readyCount > 0 ? " dot-ok" : ""}`}
            aria-hidden="true"
          />
          {readyCount === 0
            ? "No documents ready"
            : `${readyCount} ${readyCount === 1 ? "document" : "documents"} ready`}
        </p>
      </header>

      <main className="workspace">
        <aside className="library" aria-label="Documents">
          <UploadPanel onDocumentsChange={setDocs} />
        </aside>

        <section className="conversation" id="chat" aria-label="Conversation">
          <Chat disabled={readyCount === 0} onEvidence={showEvidence} />
        </section>

        <aside className="evidence" aria-label="Sources">
          <EvidencePanel
            sources={evidence.sources}
            active={evidence.active}
            pulse={evidence.pulse}
            onSelect={(index) => showEvidence(evidence.sources, index)}
          />
        </aside>
      </main>

      <footer className="footer">
        <p>Developed by Muhammad Waleed 2026</p>
      </footer>
    </div>
  );
}