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
};

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}
