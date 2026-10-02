# Evaluation results

Run: 2026-10-02T13:46:58.666Z

## Summary

| Metric | Result | Target |
|---|---|---|
| Correct and cited | 2/2 (100%) | >= 80% |
| Unanswerable refused | 5/5 (100%) | >= 80% |
| False refusals | 0/2 | as low as possible |
| Errors | 0 | 0 |
| Average latency | 2.3s | |
| Overall | PASS | |

## Threshold tuning

| minScore | Answerable kept | Unanswerable refused |
|---|---|---|
| 0.30 | 100% | 0% |
| 0.35 | 100% | 0% |
| 0.40 | 100% | 0% |
| 0.45 | 100% | 40% |
| 0.50 | 100% | 100% |
| 0.55 | 100% | 100% |
| 0.60 | 100% | 100% |
| 0.65 | 50% | 100% |
| 0.70 | 50% | 100% |
| 0.75 | 0% | 100% |
| 0.80 | 0% | 100% |
| 0.85 | 0% | 100% |

## Per-question results

| ID | Type | Result | Score | Notes | Question |
|---|---|---|---|---|---|
| a01 | answerable | pass | 0.728 |  | What is the email address listed for Muhammad Waleed? |
| a02 | answerable | pass | 0.601 |  | What is the email address listed in the contact section? |
| u01 | unanswerable | pass | 0.446 |  | What is the capital of France? |
| u02 | unanswerable | pass | 0.460 |  | Who won the 2018 FIFA World Cup? |
| u03 | unanswerable | pass | 0.437 |  | How do I bake sourdough bread? |
| u04 | unanswerable | pass | 0.460 |  | What is 15 percent of 240? |
| u05 | unanswerable | pass | 0.456 |  | What is the weather like in Tokyo today? |
