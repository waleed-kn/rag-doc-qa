import type { Source } from "@/lib/api-client";

interface EvidencePanelProps {
  sources: Source[];
  active: number | null;
  pulse: number;
  onSelect: (index: number) => void;
}

export function SourceCard({
  source,
  active,
  pulse,
  onSelect,
}: {
  source: Source;
  active: number | null;
  pulse: number;
  onSelect?: (index: number) => void;
}) {
  const isActive = active === source.index;

  return (
    <button
      type="button"
      className={`source${isActive ? " is-active" : ""}${source.cited ? " is-cited" : ""}`}
      onClick={() => onSelect?.(source.index)}
      aria-label={`Open source ${source.index}`}
    >
      <div className="source-head">
        <div className="source-title">
          <p className="source-file">{source.filename}</p>
          <p className="source-meta">
            {source.page ? `Page ${source.page}` : "Document snippet"}
            {source.score ? ` • score ${source.score.toFixed(2)}` : ""}
          </p>
        </div>
        <span className={`tag${source.cited ? " tag-used" : ""}`}>
          {source.cited ? "Used" : `#${source.index}`}
        </span>
      </div>

      <p className="source-excerpt" key={`${source.index}-${pulse}`}>
        <span className="hl">{source.excerpt || "No excerpt available."}</span>
      </p>
    </button>
  );
}

export default function EvidencePanel({
  sources,
  active,
  pulse,
  onSelect,
}: EvidencePanelProps) {
  return (
    <>
      <div className="evidence-head">
        <h2 className="panel-title">Evidence</h2>
      </div>

      {sources.length === 0 ? (
        <p className="evidence-empty">No sources yet. Ask a question to see supporting passages.</p>
      ) : (
        <div className="evidence-list">
          {sources.map((source) => (
            <SourceCard
              key={source.index}
              source={source}
              active={active}
              pulse={pulse}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </>
  );
}
