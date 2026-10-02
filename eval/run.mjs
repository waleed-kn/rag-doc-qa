// Runs every question in eval/questions.json against /api/ask and scores it.
// Usage: npm run eval
//        npm run eval -- --delay 30000 --base http://localhost:3000
import fs from "node:fs";

const args = process.argv.slice(2);
const getArg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] !== undefined ? args[i + 1] : fallback;
};

const BASE_URL = getArg("base", "http://localhost:3000");
const FILE = getArg("file", "eval/questions.json");
const DELAY_MS = Number(getArg("delay", "20000")); // pause after each LLM call (Groq free-tier TPM)
const BUSY_RETRIES = 3;
const BUSY_WAIT_MS = 30_000;
const TARGET_CORRECT = 0.8;
const TARGET_REFUSAL = 0.8;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const lower = (s) => String(s).toLowerCase();
const pct = (n) => `${(n * 100).toFixed(0)}%`;
const cell = (s) => String(s ?? "").replace(/\|/g, "/").replace(/\s+/g, " ").slice(0, 90);

function loadQuestions() {
  if (!fs.existsSync(FILE)) {
    console.error(`${FILE} not found. Create it with: npm run eval:draft`);
    process.exit(1);
  }
  const raw = JSON.parse(fs.readFileSync(FILE, "utf8"));
  const questions = raw.questions ?? raw;
  const bad = questions.filter(
    (q) => !q.id || !q.question || !["answerable", "unanswerable"].includes(q.type) || /TODO/i.test(q.question)
  );
  if (bad.length > 0) {
    console.error("Fix these questions first (missing id, question, type, or contains TODO):");
    for (const q of bad) console.error("  ", JSON.stringify(q));
    process.exit(1);
  }
  return questions;
}

async function ask(question) {
  for (let attempt = 0; ; attempt++) {
    const started = Date.now();
    let res;
    try {
      res = await fetch(`${BASE_URL}/api/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
    } catch (err) {
      console.error(`Cannot reach ${BASE_URL}. Is "npm run dev" running?`);
      process.exit(1);
    }
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: { code: "NON_JSON", message: text.slice(0, 200) } };
    }
    const latencyMs = Date.now() - started;
    if (res.status === 503 && attempt < BUSY_RETRIES) {
      console.log(`   busy (${data.error?.code}), waiting ${BUSY_WAIT_MS / 1000}s...`);
      await sleep(BUSY_WAIT_MS);
      continue;
    }
    return { status: res.status, data, latencyMs };
  }
}

function grade(q, { status, data }) {
  if (status !== 200) {
    return { outcome: "error", detail: data.error?.code ?? `HTTP ${status}` };
  }

  if (q.type === "unanswerable") {
    return data.answered === false
      ? { outcome: "pass" }
      : { outcome: "fail", detail: "answered a question that is not in the document" };
  }

  if (!data.answered) {
    return { outcome: "fail", detail: "false refusal", falseRefusal: true };
  }

  // Keywords: at least half must appear in the answer (minimum 1).
  const keywords = q.keywords ?? [];
  const needed = keywords.length ? Math.max(1, Math.ceil(keywords.length / 2)) : 0;
  const hits = keywords.filter((k) => lower(data.answer).includes(lower(k))).length;
  const keywordOk = hits >= needed;

  // Citation: the answer must cite at least one source, and if the question
  // names an expected page, a cited source must come from that page.
  const cited = (data.sources ?? []).filter((s) => s.cited);
  const citationOk =
    cited.length > 0 && (q.expectedPage == null || cited.some((s) => s.page === q.expectedPage));

  const problems = [];
  if (!keywordOk) problems.push(`keywords ${hits}/${keywords.length}`);
  if (!citationOk) problems.push(cited.length === 0 ? "no citation" : "wrong page cited");

  return {
    outcome: keywordOk && citationOk ? "pass" : "fail",
    keywordOk,
    citationOk,
    detail: problems.join(", ") || undefined,
  };
}

function sweep(answerableScores, unanswerableScores) {
  const rows = [];
  for (let t = 30; t <= 85; t += 5) {
    const th = t / 100;
    const recall = answerableScores.length
      ? answerableScores.filter((s) => s >= th).length / answerableScores.length
      : 0;
    const refusal = unanswerableScores.length
      ? unanswerableScores.filter((s) => s < th).length / unanswerableScores.length
      : 0;
    rows.push({ th, recall, refusal, balanced: (recall + refusal) / 2 });
  }
  return rows;
}

// ---------- run ----------
const questions = loadQuestions();
console.log(`Running ${questions.length} questions against ${BASE_URL}\n`);

const results = [];
for (let i = 0; i < questions.length; i++) {
  const q = questions[i];
  const result = await ask(q.question);
  const g = grade(q, result);
  const score = result.status === 200 ? result.data.topScore ?? 0 : null;

  results.push({
    id: q.id,
    type: q.type,
    question: q.question,
    ...g,
    topScore: score,
    latencyMs: result.latencyMs,
    model: result.data.model ?? null,
    answer: result.data.answer ?? null,
  });

  console.log(
    `[${q.id}] ${g.outcome.toUpperCase()} | score ${score === null ? "n/a" : score.toFixed(3)} | ${(
      result.latencyMs / 1000
    ).toFixed(1)}s${g.detail ? " | " + g.detail : ""}`
  );

  const usedLlm = result.status === 200 && result.data.model;
  if (usedLlm && DELAY_MS > 0 && i < questions.length - 1) await sleep(DELAY_MS);
}

// ---------- summarize ----------
const answerable = results.filter((r) => r.type === "answerable");
const unanswerable = results.filter((r) => r.type === "unanswerable");

const correct = answerable.filter((r) => r.outcome === "pass").length;
const falseRefusals = answerable.filter((r) => r.falseRefusal).length;
const refused = unanswerable.filter((r) => r.outcome === "pass").length;
const errors = results.filter((r) => r.outcome === "error").length;
const avgLatency = results.length
  ? results.reduce((a, r) => a + r.latencyMs, 0) / results.length / 1000
  : 0;

const correctRate = answerable.length ? correct / answerable.length : 0;
const refusalRate = unanswerable.length ? refused / unanswerable.length : 0;
const passed = correctRate >= TARGET_CORRECT && refusalRate >= TARGET_REFUSAL && errors === 0;

const aScores = answerable.filter((r) => r.topScore !== null).map((r) => r.topScore);
const uScores = unanswerable.filter((r) => r.topScore !== null).map((r) => r.topScore);
const rows = sweep(aScores, uScores);
const best = [...rows].sort((a, b) => b.balanced - a.balanced || b.recall - a.recall || a.th - b.th)[0];

const minA = aScores.length ? Math.min(...aScores) : null;
const maxU = uScores.length ? Math.max(...uScores) : null;
const clearGap = minA !== null && maxU !== null && minA > maxU;
const suggestion = clearGap ? (minA + maxU) / 2 : best?.th;

console.log("\n===== SUMMARY =====");
console.log(`Correct and cited:    ${correct}/${answerable.length} (${pct(correctRate)})  target >= ${pct(TARGET_CORRECT)}`);
console.log(`False refusals:       ${falseRefusals}/${answerable.length}`);
console.log(`Unanswerable refused: ${refused}/${unanswerable.length} (${pct(refusalRate)})  target >= ${pct(TARGET_REFUSAL)}`);
console.log(`Errors:               ${errors}`);
console.log(`Average latency:      ${avgLatency.toFixed(1)}s`);
console.log(`RESULT:               ${passed ? "PASS" : "FAIL"}`);

console.log("\n===== THRESHOLD TUNING =====");
console.log(`Answerable scores:   min ${minA?.toFixed(3) ?? "n/a"}`);
console.log(`Unanswerable scores: max ${maxU?.toFixed(3) ?? "n/a"}`);
console.log("threshold | answerable kept | unanswerable refused");
for (const r of rows) {
  console.log(`   ${r.th.toFixed(2)}   |      ${pct(r.recall).padStart(4)}       |        ${pct(r.refusal).padStart(4)}`);
}
if (suggestion !== undefined) {
  console.log(
    clearGap
      ? `\nThe scores separate cleanly. Suggested minScore: ${suggestion.toFixed(2)}`
      : `\nThe scores overlap. Best balanced minScore from the table: ${suggestion.toFixed(2)}`
  );
  console.log("Set it in src/lib/config.ts (retrieval.minScore), restart the server, and run the eval again.");
}

// ---------- report files ----------
fs.mkdirSync("eval/results", { recursive: true });
fs.writeFileSync(
  "eval/results/latest.json",
  JSON.stringify(
    {
      ranAt: new Date().toISOString(),
      baseUrl: BASE_URL,
      summary: { correct, answerable: answerable.length, falseRefusals, refused, unanswerable: unanswerable.length, errors, avgLatencySeconds: Number(avgLatency.toFixed(2)), passed },
      thresholdSweep: rows,
      suggestedMinScore: suggestion ?? null,
      results,
    },
    null,
    2
  )
);

const md = [
  "# Evaluation results",
  "",
  `Run: ${new Date().toISOString()}`,
  "",
  "## Summary",
  "",
  "| Metric | Result | Target |",
  "|---|---|---|",
  `| Correct and cited | ${correct}/${answerable.length} (${pct(correctRate)}) | >= ${pct(TARGET_CORRECT)} |`,
  `| Unanswerable refused | ${refused}/${unanswerable.length} (${pct(refusalRate)}) | >= ${pct(TARGET_REFUSAL)} |`,
  `| False refusals | ${falseRefusals}/${answerable.length} | as low as possible |`,
  `| Errors | ${errors} | 0 |`,
  `| Average latency | ${avgLatency.toFixed(1)}s | |`,
  `| Overall | ${passed ? "PASS" : "FAIL"} | |`,
  "",
  "## Threshold tuning",
  "",
  "| minScore | Answerable kept | Unanswerable refused |",
  "|---|---|---|",
  ...rows.map((r) => `| ${r.th.toFixed(2)} | ${pct(r.recall)} | ${pct(r.refusal)} |`),
  "",
  "## Per-question results",
  "",
  "| ID | Type | Result | Score | Notes | Question |",
  "|---|---|---|---|---|---|",
  ...results.map(
    (r) =>
      `| ${r.id} | ${r.type} | ${r.outcome} | ${r.topScore === null ? "n/a" : r.topScore.toFixed(3)} | ${cell(r.detail)} | ${cell(r.question)} |`
  ),
  "",
].join("\n");
fs.writeFileSync("eval/results/latest.md", md);
console.log("\nSaved eval/results/latest.md and eval/results/latest.json");

process.exit(passed ? 0 : 1);
