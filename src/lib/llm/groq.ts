import { config, requireEnv } from "../config";

export class LlmError extends Error {
    constructor(
        message: string,
        public retryable: boolean
    ) {
        super(message);
    }
}

export interface LlmResult {
    text: string;
    model: string;
    promptTokens: number;
    completionTokens: number;
}

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

export async function groqChat(
    model: string,
    system: string,
    user: string
): Promise<LlmResult> {
    let res: Response;
    try {
        res = await fetch(GROQ_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${requireEnv("GROQ_API_KEY")}`,
            },
            body: JSON.stringify({
                model,
                messages: [
                    { role: "system", content: system },
                    { role: "user", content: user },
                ],
                temperature: config.llm.temperature,
                max_completion_tokens: config.llm.maxCompletionTokens,
            }),
            signal: AbortSignal.timeout(30_000),
        });
    } catch (err) {
        // Network error or timeout: worth trying the next model.
        throw new LlmError(`Groq ${model} request failed: ${String(err)}`, true);
    }

    if (!res.ok) {
        const body = await res.text();
        // 429 = rate limited, 404 = model not found, 5xx = Groq problem
        const retryable = res.status === 429 || res.status === 404 || res.status >= 500;
        throw new LlmError(
            `Groq ${model} failed with ${res.status}: ${body.slice(0, 300)}`,
            retryable
        );
    }

    const data = await res.json();
    const text: string = data.choices?.[0]?.message?.content?.trim() ?? "";

    // Reasoning models can spend all their tokens thinking and return nothing.
    if (!text) {
        throw new LlmError(`Groq ${model} returned an empty answer`, true);
    }

    return {
        text,
        model,
        promptTokens: data.usage?.prompt_tokens ?? 0,
        completionTokens: data.usage?.completion_tokens ?? 0,
    };
}