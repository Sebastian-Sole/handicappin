# Batch Ingestion (a list of courses)

The single-course path (`/ingest-course`, the `course-scraper` agent) is the unit. To ingest a LIST, fan it out — **one `course-scraper` agent per course** — because club-site extraction is layout-adaptive and genuinely needs an agent each. This is the multi-agent Workflow path (explicit opt-in: it spawns agents and is billed).

## Parallel IS safe — with isolated browser sessions

agent-browser supports concurrent isolated sessions (`--session <name>`: separate cookies / storage / tabs / state). Each scraper MUST use a unique session (the course slug) so parallel agents don't collide on one shared browser:

```
agent-browser --session <slug> open <url>
agent-browser --session <slug> eval '...'
agent-browser --session <slug> close
```

Without `--session`, parallel agents stomp each other's navigation and refs. (`agent-browser session list` shows active sessions; `agent-browser close --all` cleans up everything.)

## Concurrency: parallel, but capped

- Cap at ~**4–6 concurrent scrapers**. The limit is machine RAM (each session ≈ a Chrome instance) and **politeness to target sites** (don't hammer a club's server) — not our pipeline (normalize/validate is ~5 ms).
- A Workflow caps concurrency automatically (min(16, cores−2)); keep the effective scraper pool small and avoid back-to-back hits on the same host.

## Don't halt on failure — classify and log

Each course resolves to exactly one status; the batch continues regardless.

| status | meaning |
|---|---|
| `staged` | success → `_staging/<slug>.sql` (pending) |
| `staged_with_warnings` | success but has WARNs (e.g. fabricated nine ratings) |
| `not_found` | no club site and no GolfPass entry |
| `no_data` | found, but no scorecard/slope data (or PDF-only we couldn't parse) |
| `incomplete` | partial data → pipeline ERROR (missing ratings / stroke index) |
| `ambiguous` | multiple plausible matches → needs human disambiguation |
| `validation_failed` | extracted, but the validator found source mismatches |

## The review log (your triage worklist)

Write every result to **`scripts/sql/_staging/_batch-report.md`** — a table of `input → status → reason → source → staged path`. The non-`staged` rows are exactly what you review by hand. Keep the raw per-course results in `_batch-report.jsonl` too, so a re-run can skip what already succeeded. Successes stay `pending` in `_staging/` until you promote them (`bash scripts/build-seed.sh` after moving files up).

## Input format

A plain list — one course per line, with optional `| country` and/or `| url` hints:

```
Tyrifjord Golfklubb | Norway
Carnoustie Championship | Scotland | https://www.carnoustiegolflinks.com/...
Oslo Golfklubb | Norway
```
