import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is missing. Check .env.local");
  process.exit(1);
}

const client = new pg.Client({ connectionString });
await client.connect();

const dir = path.join(process.cwd(), "migrations");
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

for (const file of files) {
  console.log(`Running ${file} ...`);
  await client.query(fs.readFileSync(path.join(dir, file), "utf8"));
}

await client.end();
console.log("Migrations complete.");
