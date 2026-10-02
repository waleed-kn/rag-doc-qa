# Evaluation

Measures whether the app answers correctly, cites the right page, and refuses
questions that are not in your documents.

## Steps

1. Make sure one document is fully ingested and the dev server is running.
2. Draft the question set (needs GROQ_API_KEY, takes about 5 minutes):
   npm run eval:draft
3. Open eval/questions.json and read every question.
   - Fix or delete bad questions.
   - Rewrite a few answerable ones in your own words (drafts are easier than real questions).
   - Add 2 or 3 unanswerable questions close to your document's topic.
4. Run the evaluation (about 10 minutes, paced for the Groq free tier):
   npm run eval
5. Read the THRESHOLD TUNING table, set retrieval.minScore in src/lib/config.ts,
   restart the server, and run npm run eval again.
6. Put the numbers from eval/results/latest.md into the main README.

## How scoring works

- Answerable: pass if the app answered, at least half of the keywords appear in the
  answer, and a cited source comes from the expected page.
- Unanswerable: pass if the app refused.
- Targets: 80% correct and cited, 80% refused, zero errors.

## Question format

See questions.example.json. Fields: id, type (answerable or unanswerable),
question, keywords (answerable), expectedPage (optional).
