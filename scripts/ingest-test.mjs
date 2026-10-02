import fs from "node:fs";
import path from "node:path";

const [, , filePath, baseUrl = "http://localhost:3000"] = process.argv;

if (!filePath) {
  console.error("Usage: npm run ingest:test -- <path-to-file> [baseUrl]");
  process.exit(1);
}

async function readBody(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { nonJsonResponse: text.slice(0, 300) };
  }
}

const form = new FormData();
form.append(
  "file",
  new Blob([fs.readFileSync(filePath)]),
  path.basename(filePath)
);

const upload = await fetch(`${baseUrl}/api/documents`, {
  method: "POST",
  body: form,
});
const created = await readBody(upload);
console.log("Upload:", upload.status, created);
if (!upload.ok) process.exit(1);

let remaining = created.totalChunks;
let failures = 0;

while (remaining > 0) {
  const res = await fetch(
    `${baseUrl}/api/documents/${created.documentId}/process`,
    { method: "POST" }
  );
  const body = await readBody(res);
  console.log("Process:", res.status, body);

  if (!res.ok) {
    failures++;
    if (failures >= 5) {
      console.error("Too many failures, stopping.");
      process.exit(1);
    }
    await new Promise((r) => setTimeout(r, 5000));
    continue;
  }
  failures = 0;
  remaining = body.remaining;
}

console.log("Done. Document is ready.");
