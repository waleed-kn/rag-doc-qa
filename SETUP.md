# rag-doc-qa: source files (Phases 3, 4, 5 and the chat UI)

This zip holds every source file written so far. It does NOT include the Next.js
scaffold (package.json, node_modules, tsconfig.json, next.config, globals.css,
layout.tsx), because you already have those from create-next-app.

## How to use it

1. Extract the zip and copy these over your project, keeping the same paths:
   - migrations/
   - scripts/
   - src/        (includes the new src/components/ and src/app/page.tsx)
   - eval/
   - docs/
   - .env.example
   NOTE: src/app/page.tsx replaces your current home page on purpose.
   Do NOT overwrite your own eval/questions.json (it is not in the zip anyway).
2. Make sure the folder is src/app/api/documents (with an s).
3. Install dependencies if you have not yet:
   npm install pg @google/genai unpdf
   npm install -D @types/pg
4. In package.json, make "scripts" include these lines:
   "migrate": "node --env-file=.env.local scripts/migrate.mjs",
   "ingest:test": "node scripts/ingest-test.mjs",
   "ask:test": "node scripts/ask-test.mjs",
   "eval:draft": "node --env-file=.env.local eval/draft-questions.mjs",
   "eval": "node eval/run.mjs"
5. Optional: in src/app/layout.tsx, set the page title:
   export const metadata: Metadata = {
     title: "RAG Document Q&A",
     description: "Ask questions about your documents and get cited answers.",
   };
6. Keep your own .env.local (never in the zip). It needs:
   DATABASE_URL, GEMINI_API_KEY, GROQ_API_KEY
7. npm run dev, then open http://localhost:3000
