# rag-doc-qa: source files (Phases 3 to 5, chat UI, tests, CI)

This zip holds every source file written so far. It does NOT include the Next.js
scaffold (package.json, package-lock.json, node_modules, tsconfig.json, next.config,
globals.css, layout.tsx), because you already have those from create-next-app.

## How to use it

1. Extract the zip and copy these over your project, keeping the same paths:
   - migrations/  scripts/  src/  eval/  docs/  tests/  .github/
   - vitest.config.ts
   - .env.example
   NOTE: src/app/page.tsx replaces your current home page on purpose.
   Do NOT overwrite your own eval/questions.json (it is not in the zip anyway).
2. Install the test runner:
   npm install -D vitest
3. In package.json, make "scripts" include these lines (keep your existing ones):
   "migrate": "node --env-file=.env.local scripts/migrate.mjs",
   "ingest:test": "node scripts/ingest-test.mjs",
   "ask:test": "node scripts/ask-test.mjs",
   "eval:draft": "node --env-file=.env.local eval/draft-questions.mjs",
   "eval": "node eval/run.mjs",
   "test": "vitest run",
   "test:watch": "vitest",
   "typecheck": "tsc --noEmit"
4. Keep your own .env.local (never in the zip). It needs:
   DATABASE_URL, GEMINI_API_KEY, GROQ_API_KEY
5. Run the checks locally BEFORE pushing (CI runs the same ones):
   npm test
   npm run typecheck
   npm run lint
   npm run build
6. Commit everything, including package-lock.json (npm ci needs it in sync):
   git add .
   git commit -m "test: unit tests and CI workflow"
   git push
7. Open the Actions tab on GitHub and wait for a green check.

Expected: 4 test files, 25 tests passing.
