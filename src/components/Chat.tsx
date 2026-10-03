"use client";

import { useEffect, useRef, useState } from "react";
import { ApiError, askQuestion, type Source } from "@/lib/api-client";
import { SourceCard } from "@/components/EvidencePanel";

interface Message {
  id: number;
  role: "user" | "assistant";
  text: string;
  answered?: boolean;
  sources?: Source[];
  model?: string | null;
  isError?: boolean;
}

interface Props {
  disabled: boolean;
  onEvidence: (sources: Source[], active: number | null) => void;
}

const MAX_CHARS = 500;

const SUGGESTIONS = [
  "What is this document about?",
  "Summarize the main points",
  "List any important dates or numbers",
];

// Turns [1] markers in the answer into buttons that open the matching source.
function AnswerText({
  text,
  onCite,
}: {
  text: string;
  onCite: (n: number) => void;
}) {
  const parts = text.split(/(\[\d+\])/g);
  return (
    <p className="answer-text">
      {parts.map((part, i) => {
        const match = part.match(/^\[(\d+)\]$/);
        if (!match) return <span key={i}>{part}</span>;
        const n = Number(match[1]);
        return (
          <button
            key={i}
            type="button"
            className="cite"
            onClick={() => onCite(n)}
            aria-label={`Show source ${n}`}
          >
            {n}
          </button>
        );
      })}
    </p>
  );
}

export default function Chat({ disabled, onEvidence }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const nextId = useRef(1);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    bottomRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
  }, [messages, loading]);

  function resize(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }

  function fillPrompt(text: string) {
    setInput(text);
    inputRef.current?.focus();
  }

  async function send() {
    const question = input.trim();
    if (!question || loading || disabled) return;

    const userId = nextId.current++;
    const replyId = nextId.current++;

    setInput("");
    if (inputRef.current) inputRef.current.style.height = "auto";
    setMessages((m) => [...m, { id: userId, role: "user", text: question }]);
    setLoading(true);

    try {
      const res = await askQuestion(question);
      const sources = res.sources ?? [];

      setMessages((m) => [
        ...m,
        {
          id: replyId,
          role: "assistant",
          text: res.answer,
          answered: res.answered,
          sources,
          model: res.model,
        },
      ]);

      if (res.answered && sources.length > 0) {
        const firstCited = sources.find((s) => s.cited)?.index ?? sources[0].index;
        onEvidence(sources, firstCited);
      }
    } catch (err) {
      const text =
        err instanceof ApiError ? err.message : "Could not reach the server.";
      setMessages((m) => [
        ...m,
        { id: replyId, role: "assistant", text, isError: true },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="chat">
      <div className="messages">
        <div className="thread" role="log" aria-live="polite">
          {messages.length === 0 && (
            <div className="empty">
              <h2 className="empty-title">
                {disabled
                  ? "Add a document to begin"
                  : "Ask a question about your documents"}
              </h2>
              <p className="empty-text">
                {disabled
                  ? "Upload a PDF, TXT, or Markdown file in the Documents panel. When it shows Ready, you can start asking."
                  : "Every answer shows the pages it came from, so you can check it yourself."}
              </p>
              {!disabled && (
                <div className="chips">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className="chip"
                      onClick={() => fillPrompt(s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {messages.map((m) => {
            if (m.role === "user") {
              return (
                <div key={m.id} className="msg-user">
                  <p className="bubble">{m.text}</p>
                </div>
              );
            }

            if (m.isError) {
              return (
                <div key={m.id} className="msg-assistant">
                  <div className="error-note" role="alert">
                    <div>
                      <p className="note-title">That didn&apos;t work</p>
                      <p className="note-text">{m.text}</p>
                    </div>
                  </div>
                </div>
              );
            }

            if (m.answered === false) {
              return (
                <div key={m.id} className="msg-assistant">
                  <div className="note">
                    <svg
                      className="note-icon"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      aria-hidden="true"
                    >
                      <circle cx="12" cy="12" r="9" />
                      <path d="M12 8v5M12 16.5h.01" />
                    </svg>
                    <div>
                      <p className="note-title">Not found in your documents</p>
                      <p className="note-text">
                        Try rephrasing the question, or upload the document that
                        covers it.
                      </p>
                    </div>
                  </div>
                </div>
              );
            }

            const sources = m.sources ?? [];
            return (
              <div key={m.id} className="msg-assistant">
                <AnswerText
                  text={m.text}
                  onCite={(n) => onEvidence(sources, n)}
                />

                {sources.length > 0 && (
                  <details className="inline-sources">
                    <summary>Sources ({sources.length})</summary>
                    <div className="inline-list">
                      {sources.map((s) => (
                        <SourceCard
                          key={s.index}
                          source={s}
                          active={null}
                          pulse={0}
                        />
                      ))}
                    </div>
                  </details>
                )}

                {m.model && <p className="msg-meta">Answered by {m.model}</p>}
              </div>
            );
          })}

          {loading && (
            <div className="thinking" role="status">
              <span className="dots" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
              Searching your documents
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <div className="composer-inner">
          <div className="composer-box">
            <textarea
              ref={inputRef}
              className="composer-input"
              value={input}
              rows={1}
              disabled={disabled}
              aria-label="Your question"
              placeholder={
                disabled ? "Upload a document first" : "Ask about your documents"
              }
              onChange={(e) => {
                setInput(e.target.value.slice(0, MAX_CHARS));
                resize(e.target);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
            />
            <button
              type="submit"
              className="send-btn"
              disabled={disabled || loading || !input.trim()}
            >
              Ask
            </button>
          </div>
          <div className="composer-foot">
            <span className="hint">Enter to send, Shift and Enter for a new line</span>
            <span>
              {input.length >= 400 ? `${input.length}/${MAX_CHARS}` : ""}
            </span>
          </div>
        </div>
      </form>
    </div>
  );
}