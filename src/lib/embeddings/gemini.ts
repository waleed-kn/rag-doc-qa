import { GoogleGenAI } from "@google/genai";
import { config, requireEnv } from "../config";
import { AppError } from "../errors";
import { isRetryable, withRetry } from "../retry";
import type { EmbeddingProvider } from "./types";

let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!client) {
    client = new GoogleGenAI({ apiKey: requireEnv("GEMINI_API_KEY") });
  }
  return client;
}

async function embed(texts: string[], taskType: string): Promise<number[][]> {
  try {
    const res = await withRetry(
      () =>
        getClient().models.embedContent({
          model: config.embedding.model,
          contents: texts,
          config: {
            taskType,
            outputDimensionality: config.embedding.dimensions,
          },
        }),
      config.ingestion
    );

    const vectors = (res.embeddings ?? []).map((e) => e.values ?? []);

    if (vectors.length !== texts.length) {
      throw new Error(
        `Expected ${texts.length} embeddings, got ${vectors.length}`
      );
    }
    for (const v of vectors) {
      if (v.length !== config.embedding.dimensions) {
        throw new Error(
          `Embedding dimension mismatch: expected ${config.embedding.dimensions}, got ${v.length}`
        );
      }
    }
    return vectors;
  } catch (err) {
    if (isRetryable(err)) {
      throw new AppError(
        "EMBEDDING_BUSY",
        "The embedding service is busy. Try again in a minute.",
        503
      );
    }
    throw err;
  }
}

export const geminiEmbeddings: EmbeddingProvider = {
  embedDocuments: (texts) => embed(texts, "RETRIEVAL_DOCUMENT"),
  embedQuery: async (text) => (await embed([text], "QUESTION_ANSWERING"))[0],
};
