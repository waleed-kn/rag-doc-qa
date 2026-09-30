import { geminiEmbeddings } from "./gemini";
import type { EmbeddingProvider } from "./types";

// To swap providers later, change only this function.
export function getEmbeddingProvider(): EmbeddingProvider {
  return geminiEmbeddings;
}
