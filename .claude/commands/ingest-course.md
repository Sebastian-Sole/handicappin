---
description: "Scrape/convert one golf course into validated seed SQL (course/teeInfo/hole), staged as pending for review."
allowed-tools:
  - Read
  - Write
  - Bash
  - WebSearch
  - WebFetch
  - Task
argument-hint: "<course name | golfpass URL | path/to/raw.json>"
---

# Ingest Course

Ingest one course into `scripts/sql/_staging/` as `approvalStatus='pending'`. Load the `course-ingestion` skill first — it holds the data contract, the source catalog, the extraction recipe, and the gotchas.

## What to do

1. **Resolve the input** ($ARGUMENTS):
   - a `*.raw.json` path → skip to step 4.
   - a `golfpass.com` URL → step 3.
   - a course name → `WebSearch` for its `golfpass.com/travel-advisor/courses` page, confirm it's the right course (city + country), then step 3.
2. For batch work, or anything fiddly, delegate the fetch+extract to the **course-scraper** agent and the review to **course-data-validator** rather than doing it inline.
3. **Extract** with `agent-browser` per the skill's `references/extraction.md`, then build the raw JSON per `references/contract.md`. Confirm the distance unit from the source.
4. **Run the pipeline**:
   ```
   pnpm --filter web course:ingest <raw.json>
   ```
   Read the findings: ERRORs block (fix the raw JSON and re-run); WARNs are for review.
5. **Report**: the course, the tees emitted, any data gaps (tees with no per-hole distance), and every WARN — especially `ratings:fabricated-nine` and the unit checks.

## Stop Here

<important>
Do not move the file out of `scripts/sql/_staging/` into `scripts/sql/`, do not pass `--approve`, and do not rebuild the seed. Staging is the review gate — a human promotes reviewed courses. Wrong ratings or units silently corrupt every handicap for the course.
</important>
