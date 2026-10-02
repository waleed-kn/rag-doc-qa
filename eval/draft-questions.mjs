// Drafts an evaluation set from random chunks in your database.
// Usage: npm run eval:draft            (refuses to overwrite eval/questions.json)
//        npm run eval:draft -- --force (overwrites)
//
// IMPORTANT: questions made from a chunk are easier than real user questions.
// Read every draft and rewrite at least a few by hand.
import fs from "node:fs";
import pg from "pg";

const COUNT = Number(process.env.DRAFT_COUNT ?? 20);
const MODEL = process.env.EVAL_MODEL ?? "openai/gpt-oss-20b"; // keep in sync with src/lib/config.ts
const DELAY_MS = Number(process.env.DRAFT_DELAY_MS ?? 15000);
const OUT = "eval/questions.json";
const force = process.argv.includes("--force");

if (fs.existsSync(OUT) && !force) {
  console.error(`${OUT} already exists. Use --force to overwrite it.`);
  process.exit(1);
}
for (const name of ["DATABASE_URL", "GROQ_API_KEY"]) {
  if (!process.env[name]) {
    console.error(`${name} is missing. Run through npm so .env.local is loaded.`);
    process.exit(1);
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function groq(system, user) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.3,
        max_completion_tokens: 1200,
      }),
      signal: AbortSignal.timeout(40_000),
    });
    if (res.status === 429) {
      console.log("   rate limited, waiting 30s...");
      await sleep(30_000);
      continue;
    }
    if (!res.ok) throw new Error(`Groq ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() ?? "";
  }
  throw new Error("Groq stayed rate limited");
}

function parseJson(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

const SYSTEM = `You write test questions for a document Q&A system. Reply with ONLY a JSON object, no other text:
{"question": "...", "keywords": ["...", "..."]}

Rules:
- The question must be answerable using only the given passage.
- It must make sense on its own. Never say "the passage", "the text", or "the document".
- keywords: 1 to 3 short words, numbers, or phrases that a correct answer must contain. Copy them exactly as written in the passage.`;

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
const { rows } = await client.query(
  `SELECT c.content, c.page_number AS page, d.filename
   FROM chunks c JOIN documents d ON d.id = c.document_id
   WHERE d.status = 'ready' AND length(c.content) > 300
   ORDER BY random()
   LIMIT $1`,
  [COUNT * 2]
);
await client.end();

if (rows.length === 0) {
  console.error("No ready chunks found. Ingest a document first.");
  process.exit(1);
}

const answerable = [];
for (const row of rows) {
  if (answerable.length >= COUNT) break;
  try {
    const text = await groq(SYSTEM, `Passage:\n${row.content.slice(0, 2500)}`);
    const parsed = parseJson(text);
    const q = typeof parsed?.question === "string" ? parsed.question.trim() : "";
    const keywords = (Array.isArray(parsed?.keywords) ? parsed.keywords : [])
      .map(String)
      .filter((k) => row.content.toLowerCase().includes(k.toLowerCase()))
      .slice(0, 3);

    if (q.length < 10 || keywords.length === 0) {
      console.log("skipped a chunk (bad draft)");
    } else {
      const id = `a${String(answerable.length + 1).padStart(2, "0")}`;
      answerable.push({
        id,
        type: "answerable",
        question: q,
        keywords,
        expectedPage: row.page,
        expectedFilename: row.filename,
      });
      console.log(`[${id}] ${q}`);
    }
  } catch (err) {
    console.log("skipped a chunk:", String(err.message).slice(0, 120));
  }
  await sleep(DELAY_MS);
}

const unanswerableQuestions = [
  "What is the capital of France?",
  "Who won the 2018 FIFA World Cup?",
  "How do I bake sourdough bread?",
  "What is 15 percent of 240?",
  "What is the weather like in Tokyo today?",
];
const unanswerable = unanswerableQuestions.map((question, i) => ({
  id: `u${String(i + 1).padStart(2, "0")}`,
  type: "unanswerable",
  question,
}));

fs.mkdirSync("eval", { recursive: true });
fs.writeFileSync(
  OUT,
  JSON.stringify(
    {
      note: "Review every question. Add 2 or 3 unanswerable questions that are close to your document's topic, because those are the hardest test.",
      questions: [...answerable, ...unanswerable],
    },
    null,
    2
  )
);
console.log(`\nWrote ${answerable.length} answerable and ${unanswerable.length} unanswerable questions to ${OUT}`);
