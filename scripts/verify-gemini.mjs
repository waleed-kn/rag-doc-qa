import { GoogleGenAI } from "@google/genai";

const key = process.env.GEMINI_API_KEY;
if (!key) {
    console.error("GEMINI_API_KEY is empty. Check .env.local and save the file.");
    process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: key });

try {
    const res = await ai.models.embedContent({
        model: "gemini-embedding-001",
        contents: "test sentence",
        config: { taskType: "RETRIEVAL_DOCUMENT", outputDimensionality: 768 },
    });
    console.log("OK. Embedding length:", res.embeddings[0].values.length);
} catch (err) {
    console.error("FAILED:", err.status ?? "", String(err.message).slice(0, 300));
    process.exit(1);
}