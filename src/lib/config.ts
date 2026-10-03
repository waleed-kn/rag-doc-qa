// Single source of truth for tunable values.
// NOTE: migrations/001_init.sql has VECTOR(768). If you change
// dimensions here, change the column too. /api/health checks they match.
export const config = {
  embedding: {
    model: "gemini-embedding-001",
    dimensions: 768,
  },
  chunking: {
    targetWords: 400,
    overlapWords: 50,
    maxWords: 500,
  },
  upload: {
    maxBytes: 4 * 1024 * 1024, // 4 MB (Vercel body limit is about 4.5 MB)
    allowedExtensions: ["pdf", "txt", "md"] as string[],
  },
  ingestion: {
    batchSize: 20,
    maxRetries: 4,
    baseDelayMs: 1000,
  },
  retrieval: {
    topK: 4,
    // Starting guess. Tune it with `npm run eval` (see eval/README.md).
    minScore: 0.55,
  },
  llm: {
    // Tried in order. If the first is rate limited, the next one is used.
    models: ["openai/gpt-oss-20b", "qwen/qwen3.8-27b"],
    maxCompletionTokens: 800,
    temperature: 0.2,
  },
  ask: {
    maxQuestionChars: 500,
  },
  rateLimit: {
    ask: {
      perIpPerMinute: 3,
      perIpPerDay: 20,
      globalPerMinute: 5,
      globalPerDay: 100,
    },
    upload: { perIpPerHour: 5 },
    process: { perIpPerMinute: 30 },
  },
};

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}
