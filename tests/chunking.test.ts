import { describe, expect, it } from "vitest";
import { chunkPages } from "../src/lib/chunking";

const opts = { targetWords: 20, overlapWords: 5, maxWords: 30 };

// words(3, "w") -> "w1 w2 w3"
const words = (n: number, prefix = "w") =>
  Array.from({ length: n }, (_, i) => `${prefix}${i + 1}`).join(" ");

const wordCount = (s: string) => s.split(/\s+/).filter(Boolean).length;

describe("chunkPages", () => {
  it("returns no chunks when there are no pages", () => {
    expect(chunkPages([], opts)).toEqual([]);
  });

  it("keeps a short page as one chunk with its page number", () => {
    const chunks = chunkPages(
      [{ pageNumber: 3, text: "Refunds take 30 days." }],
      opts
    );
    expect(chunks).toHaveLength(1);
    expect(chunks[0].pageNumber).toBe(3);
    expect(chunks[0].chunkIndex).toBe(0);
    expect(chunks[0].content).toBe("Refunds take 30 days.");
  });

  it("never mixes text from two pages in one chunk", () => {
    const chunks = chunkPages(
      [
        { pageNumber: 1, text: "alpha beta gamma" },
        { pageNumber: 2, text: "delta epsilon zeta" },
      ],
      opts
    );
    expect(chunks.map((c) => c.pageNumber)).toEqual([1, 2]);
    expect(chunks[0].content.includes("delta")).toBe(false);
  });

  it("numbers chunks one after another across pages", () => {
    const pages = [1, 2, 3].map((n) => ({
      pageNumber: n,
      text: words(15, `p${n}_`),
    }));
    const chunks = chunkPages(pages, opts);
    expect(chunks.map((c) => c.chunkIndex)).toEqual([0, 1, 2]);
  });

  it("splits long text into several chunks within the size limit", () => {
    const text = Array.from({ length: 12 }, (_, i) => words(10, `s${i}_`)).join(
      "\n\n"
    );
    const chunks = chunkPages([{ pageNumber: 1, text }], opts);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) {
      expect(wordCount(c.content)).toBeLessThanOrEqual(
        opts.maxWords + opts.overlapWords
      );
    }
  });

  it("repeats the end of one chunk at the start of the next", () => {
    const text = Array.from({ length: 6 }, (_, i) => words(10, `s${i}_`)).join(
      "\n\n"
    );
    const chunks = chunkPages([{ pageNumber: 1, text }], opts);
    const tail = chunks[0].content
      .split(/\s+/)
      .slice(-opts.overlapWords)
      .join(" ");
    expect(chunks[1].content.startsWith(tail)).toBe(true);
  });

  it("splits one huge unbroken paragraph by words", () => {
    const chunks = chunkPages([{ pageNumber: 1, text: words(100) }], opts);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) {
      expect(wordCount(c.content)).toBeLessThanOrEqual(
        opts.maxWords + opts.overlapWords
      );
    }
  });

  it("estimates a token count for every chunk", () => {
    const chunks = chunkPages([{ pageNumber: 1, text: words(10) }], opts);
    expect(chunks[0].tokenCount).toBeGreaterThan(0);
  });
});
