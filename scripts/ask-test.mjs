const [, , question, baseUrl = "http://localhost:3000"] = process.argv;

if (!question) {
  console.error('Usage: npm run ask:test -- "your question" [baseUrl]');
  process.exit(1);
}

const res = await fetch(`${baseUrl}/api/ask`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ question }),
});

const text = await res.text();
let data;
try {
  data = JSON.parse(text);
} catch {
  console.error("Non-JSON response:", res.status, text.slice(0, 300));
  process.exit(1);
}

if (!res.ok) {
  console.error("Error:", res.status, data);
  process.exit(1);
}

console.log("\nQuestion:", question);
console.log("\nAnswer:\n" + data.answer);
console.log("\nAnswered:", data.answered, "| Top score:", data.topScore, "| Model:", data.model);

if (data.sources.length > 0) {
  console.log("\nSources:");
  for (const s of data.sources) {
    console.log(
      `  [${s.index}] ${s.filename}, page ${s.page}, score ${s.score}${s.cited ? " (cited)" : ""}`
    );
    console.log(`      ${s.excerpt.replace(/\s+/g, " ")}...`);
  }
}
