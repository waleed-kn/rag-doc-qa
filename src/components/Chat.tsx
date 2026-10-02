"use client";

import { useEffect, useRef, useState } from "react";
import { ApiError, askQuestion, type Source } from "@/lib/api-client";

interface Message {
  id: number;
  role: "user" | "assistant";
  text: string;
  answered?: boolean;
  sources?: Source[];
  model?: string | null;
  isError?: boolean;
}

const MAX_CHARS = 500;

function SourceList({ sources }: { sources: Source[] }) {
  return (
    <div className="mt-3 border-t border-neutral-300 pt-2 dark:border-neutral-600">
      <p className="mb-1 text-xs font-semibold uppercase text-neutral-500">Sources</p>
      <ul className="space-y-1">
        {sources.map((s) => (
          <li key={s.index} className="text-xs">
            <details>
              <summary className="cursor-pointer">
                [{s.index}] {s.filename}
                {s.page ? `, page ${s.page}` : ""}
                {s.cited && (
                  <span className="ml-2 rounded bg-green-100 px-1.5 py-0.5 text-green-800 dark:bg-green-900 dark:text-green-200">
                    cited
                  </span>
                )}
              </summary>
              <p className="mt-1 whitespace-pre-wrap text-neutral-600 dark:text-neutral-300">
                {s.excerpt}...
              </p>
              <p className="text-neutral-500">similarity {s.score}</p>
            </details>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Chat({ disabled }: { disabled: boolean }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const nextId = useRef(1);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send() {
    const question = input.trim();
    if (!question || loading || disabled) return;

    setInput("");
    setMessages((m) => [...m, { id: nextId.current++, role: "user", text: question }]);
    setLoading(true);

    try {
      const res = await askQuestion(question);
      setMessages((m) => [
        ...m,
        {
          id: nextId.current++,
          role: "assistant",
          text: res.answer,
          answered: res.answered,
          sources: res.sources,
          model: res.model,
        },
      ]);
    } catch (err) {
      const text = err instanceof ApiError ? err.message : "Could not reach the server.";
      setMessages((m) => [
        ...m,
        { id: nextId.current++, role: "assistant", text, isError: true },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="flex h-[70vh] flex-col rounded-xl border border-neutral-300 dark:border-neutral-700">
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <p className="text-sm text-neutral-500">
            {disabled
              ? "Upload a document to get started."
              : "Ask a question about your documents. Answers include their sources."}
          </p>
        )}

        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${
                m.role === "user"
                  ? "bg-blue-600 text-white"
                  : m.isError
                    ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
                    : "bg-neutral-100 dark:bg-neutral-800"
              }`}
            >
              <p className="whitespace-pre-wrap">{m.text}</p>
              {m.role === "assistant" && m.answered === false && (
                <p className="mt-1 text-xs text-neutral-500">Not found in your documents.</p>
              )}
              {m.sources && m.sources.length > 0 && <SourceList sources={m.sources} />}
              {m.model && <p className="mt-2 text-xs text-neutral-500">{m.model}</p>}
            </div>
          </div>
        ))}

        {loading && <p className="text-sm text-neutral-500">Searching your documents...</p>}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-neutral-300 p-3 dark:border-neutral-700">
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value.slice(0, MAX_CHARS))}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            disabled={disabled}
            rows={2}
            placeholder={disabled ? "Upload a document first" : "Ask a question..."}
            className="flex-1 resize-none rounded-lg border border-neutral-300 bg-transparent p-2 text-sm disabled:opacity-50 dark:border-neutral-600"
          />
          <button
            onClick={() => void send()}
            disabled={disabled || loading || !input.trim()}
            className="rounded-lg bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Ask
          </button>
        </div>
        <p className="mt-1 text-right text-xs text-neutral-500">
          {input.length}/{MAX_CHARS}
        </p>
      </div>
    </section>
  );
}
