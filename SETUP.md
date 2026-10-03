# rag-doc-qa: full snapshot (ingestion, answers, UI, eval, tests, CI, Docker, rate limiting)

This zip does NOT include the Next.js scaffold or your private files:
package.json, package-lock.json, .npmrc, tsconfig.json, next.config.ts,
globals.css, layout.tsx, .env.local, eval/questions.json.

## What is new in this zip (rate limiting)
- migrations/002_rate_limits.sql
- src/lib/rate-limit.ts and src/lib/rate-limit-utils.ts
- src/lib/errors.ts (now supports a Retry-After header)
- src/lib/config.ts (new rateLimit block)
- src/app/api/ask/route.ts, src/app/api/documents/route.ts,
  src/app/api/documents/[id]/process/route.ts (call the limiter)
- tests/rate-limit.test.ts (37 tests in total)
- .env.example (RATE_LIMIT_DISABLED)
- Dockerfile, .dockerignore, .github/workflows/ci.yml (with the docker job)

## Steps
1. Copy the folders over your project, keeping the same paths.
   If you have edited any route file yourself, compare before overwriting.
2. In next.config.ts make sure you have:  output: "standalone"
3. Run the new migration:        npm run migrate
4. Add to .env.local:            RATE_LIMIT_DISABLED=true
   (do NOT set it on Vercel; the limits must stay on in production)
5. npm test (expect 5 files, 37 tests), then npm run typecheck, npm run lint, npm run build
6. To try the limiter: set RATE_LIMIT_DISABLED=false, restart, then run
   1..5 | ForEach-Object { node scripts/ask-test.mjs "What is this document about?" }
   The 4th and 5th should return 429 RATE_LIMITED. Set it back to true afterwards.
7. git add . ; git commit ; git push ; check the Actions tab.
