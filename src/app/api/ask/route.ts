import { NextRequest, NextResponse } from "next/server";
import { config } from "@/lib/config";
import { AppError, errorResponse } from "@/lib/errors";
import { retrieve } from "@/lib/retrieval";
import { buildPrompt, NOT_FOUND_MESSAGE } from "@/lib/prompt";
import { generateAnswer } from "@/lib/llm";
import { logQuery } from "@/lib/query-log";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const started = Date.now();

  try {
    let body: { question?: unknown };
    try {
      body = await req.json();
    } catch {
      throw new AppError("INVALID_REQUEST", "Send a JSON body.", 400);
    }

    const question =
      typeof body.question === "string" ? body.question.trim() : "";
    if (!question) {
      throw new AppError("INVALID_REQUEST", "Provide a question.", 400);
    }
    if (question.length > config.ask.maxQuestionChars) {
      throw new AppError(
        "QUESTION_TOO_LONG",
        `Keep the question under ${config.ask.maxQuestionChars} characters.`,
        400
      );
    }

    // 1. Find the most relevant chunks
    const chunks = await retrieve(question);
    const topScore = chunks[0]?.score ?? null;

    // 2. If nothing is relevant enough, refuse without calling the LLM
    if (chunks.length === 0 || (topScore ?? 0) < config.retrieval.minScore) {
      await logQuery({
        question,
        model: null,
        retrievedCount: chunks.length,
        topScore,
        answered: false,
        promptTokens: null,
        completionTokens: null,
        latencyMs: Date.now() - started,
      });
      return NextResponse.json({
        answer: NOT_FOUND_MESSAGE,
        answered: false,
        sources: [],
        topScore,
        model: null,
      });
    }

    // 3. Ask the LLM, with fallback between models
    const { system, user } = buildPrompt(question, chunks);
    const result = await generateAnswer(system, user);

    // 4. The model may still decide the answer is not in the sources
    const answered = !result.text
      .toLowerCase()
      .includes("could not find this in the uploaded documents");

    // 5. Build citations from our own database rows
    const citedNumbers = new Set(
      [...result.text.matchAll(/[\[【](\d+)/g)].map((m) => Number(m[1]))
    );
    const sources = answered
      ? chunks.map((c, i) => ({
        index: i + 1,
        documentId: c.documentId,
        filename: c.filename,
        page: c.pageNumber,
        score: Number(c.score.toFixed(3)),
        cited: citedNumbers.has(i + 1),
        excerpt: c.content.slice(0, 200),
      }))
      : [];

    await logQuery({
      question,
      model: result.model,
      retrievedCount: chunks.length,
      topScore,
      answered,
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
      latencyMs: Date.now() - started,
    });

    return NextResponse.json({
      answer: result.text,
      answered,
      sources,
      topScore,
      model: result.model,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
