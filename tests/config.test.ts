import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { config } from "../src/lib/config";

describe("config", () => {
  it("migration VECTOR size matches the embedding dimensions", () => {
    const sql = fs.readFileSync(
      path.join(process.cwd(), "migrations", "001_init.sql"),
      "utf8"
    );
    const match = sql.match(/VECTOR\((\d+)\)/i);
    expect(match !== null).toBe(true);
    expect(Number(match?.[1])).toBe(config.embedding.dimensions);
  });

  it("chunk overlap is smaller than the target size", () => {
    expect(config.chunking.overlapWords).toBeLessThan(config.chunking.targetWords);
  });

  it("target chunk size does not exceed the max unit size", () => {
    expect(config.chunking.targetWords).toBeLessThanOrEqual(config.chunking.maxWords);
  });

  it("minimum similarity score is between 0 and 1", () => {
    expect(config.retrieval.minScore).toBeGreaterThan(0);
    expect(config.retrieval.minScore).toBeLessThan(1);
  });

  it("has at least one LLM model configured", () => {
    expect(config.llm.models.length).toBeGreaterThan(0);
  });

  it("upload limit fits the serverless request body limit", () => {
    expect(config.upload.maxBytes).toBeLessThanOrEqual(4.5 * 1024 * 1024);
  });
});
