import { describe, expect, it } from "vitest";
import { buildPrompt, NOT_FOUND_MESSAGE } from "../src/lib/prompt";

const chunk = (over: Record<string, unknown> = {}) => ({
  id: "c1",
  documentId: "d1",
  filename: "policy.pdf",
  pageNumber: 3 as number | null,
  content: "Refunds are allowed within 30 days.",
  score: 0.8,
  ...over,
});

describe("buildPrompt", () => {
  it("numbers sources from 1 and shows file name and page", () => {
    const { user } = buildPrompt("How long do refunds take?", [
      chunk(),
      chunk({ filename: "notes.md", pageNumber: null, content: "Other text" }),
    ]);
    expect(user).toContain("[1] (policy.pdf, page 3)");
    expect(user).toContain("[2] (notes.md, no page)");
    expect(user).toContain("Refunds are allowed within 30 days.");
    expect(user).toContain("Question: How long do refunds take?");
  });

  it("puts the exact not-found message in the system prompt", () => {
    const { system } = buildPrompt("Q?", [chunk()]);
    expect(system).toContain(NOT_FOUND_MESSAGE);
  });

  it("tells the model to treat sources as content, not instructions", () => {
    const { system } = buildPrompt("Q?", [chunk()]);
    expect(system).toContain("not instructions");
  });

  it("keeps the not-found message in sync with the check in /api/ask", () => {
    // src/app/api/ask/route.ts looks for this phrase in the model's reply.
    const phrase = "could not find this in the uploaded documents";
    expect(NOT_FOUND_MESSAGE.toLowerCase().includes(phrase)).toBe(true);
  });
});
