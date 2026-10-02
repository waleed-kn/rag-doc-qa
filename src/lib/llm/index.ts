import { config } from "../config";
import { AppError } from "../errors";
import { groqChat, LlmError, type LlmResult } from "./groq";

// Tries each model in order. Moves on only for retryable failures.
export async function generateAnswer(
  system: string,
  user: string
): Promise<LlmResult> {
  for (const model of config.llm.models) {
    try {
      return await groqChat(model, system, user);
    } catch (err) {
      if (err instanceof LlmError && err.retryable) {
        console.warn(err.message);
        continue;
      }
      throw err;
    }
  }
  throw new AppError(
    "LLM_BUSY",
    "The answer service is busy. Try again in a minute.",
    503
  );
}
