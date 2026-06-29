---
name: course-ingestion
description: "Fires when populating, importing, or scraping golf course data into the courses database (course/teeInfo/hole tables) — adding a new course, batch-ingesting from GolfPass or other sources, or converting a scorecard into seed SQL."
allowed-tools: Bash(agent-browser:*), Bash(pnpm --filter web course:ingest:*), Bash(pnpm --filter web exec tsx:*), Read, Write, WebSearch, WebFetch
---

# Course Ingestion

Turns golf course data from the web into validated seed SQL for the `course` → `teeInfo` → `hole` tables.

IS for: adding/scraping real course data and converting scorecards to seed SQL.
IS NOT for: editing the handicap engine, the in-app submission UI, or user-entered rounds.

## The pipeline (proven, deterministic)

`scrape/extract` → **raw JSON** (the contract) → `course:ingest` CLI → normalize → validate (the real app zod) → DO-block SQL in `scripts/sql/_staging/`.

```
pnpm --filter web course:ingest <raw.json>          # validate + write to _staging (pending)
pnpm --filter web course:ingest <raw.json> --print   # preview SQL, write nothing
pnpm --filter web course:ingest <raw.json> --json    # machine-readable report (agents/hooks)
```

Code lives in `apps/web/scripts/course-ingest/` (`contract.ts`, `normalize.ts`, `validate.ts`, `emit-sql.ts`, `cli.ts`). Raw-contract field semantics: `references/contract.md`. Ingesting a **list** of courses (parallel scrapers + failure logging): `references/batch.md`.

## Sources (Norway + Scotland/UK first)

Prefer the **course's own website** (authoritative — GolfPass has data-quality errors), with **GolfPass as a structured fallback**. Source priority + per-source access: `references/sources.md`. Club-site (layout-adaptive) extraction: `references/club-sites.md`. The proven GolfPass recipe: `references/extraction.md`.

## The review gate (non-negotiable)

Scraped courses are written as `approvalStatus='pending'` into `scripts/sql/_staging/`, which `build-seed.sh` does **not** pick up (it globs `scripts/sql/*.sql` only, non-recursive). A human reviews, then moves the file up into `scripts/sql/` (and may re-run with `--approve --out scripts/sql`) to include it in the seed, then rebuilds with `bash scripts/build-seed.sh`. Wrong rating/slope/units silently corrupt every handicap computed for that course — review before promoting.

## Gotchas

- **Front/back-9 ratings are fabricated** unless the source publishes per-nine ratings. The pipeline derives them as `courseRating18 / 2` (slope copied) and flags `ratings:fabricated-nine`. They drive 9-hole handicap math — don't treat them as authoritative.
- **Yards vs meters is the silent killer.** Norwegian courses use meters; UK/US use yards. Mislabeling corrupts every handicap. The validator heuristically flags suspicious totals, but confirm the unit from the source page.
- **GolfPass's hole grid details only the primary men's tee and the primary women's tee** (e.g. Blue and Red — this is correct, not missing data). Other tees in the summary have ratings/totals but no per-hole distances. Emit the detailed tees and report the rest as a gap, or get the missing tees from the club's own scorecard (the better source).
- **Per-hole grid comes ONLY from the club scorecard or GolfPass** (in that order) — if neither has it, the course is **not supported** (log `no_data`, skip). Never blend aggregator distances. Emit only tees with a complete 18-hole grid; a course needs the primary men's + women's tee complete or it's skipped. Sub-9-hole courses (6-hole) are not supported. See the strict sourcing policy in `references/sources.md`.
- **Stroke index must be a permutation of 1..18** — the validator hard-fails non-permutations. 9-hole cards carry 9 values; the pipeline expands them (back nine = front + 1), matching `scripts/parse_scorecard.py`.
- **zod range violations are WARN, not ERROR.** The app's `teeSchema` assumes standard courses, but the seed legitimately holds par-3 / 9-hole courses whose derived ratings fall below zod minimums. Only structural problems (bad sums, SI collisions, missing holes, wrong types/enums) hard-fail.
- **Dedup key is `(name, country, city)`** at the DB, but the app's submit path dedups on name alone. The validator warns on a name match in `scripts/sql/`; confirm before adding.
- `scripts/parse_scorecard.py` is the legacy manual-paste path — still works, left untouched. The CLI path supersedes it for scraping because structured JSON beats reconstructing scorecard text from the DOM.
- **Rebuild the seed with `bash scripts/build-seed.sh`, never `pnpm build:seed`.** A root-level `pnpm` invocation can trip corepack into running pnpm 11 against the 10.33.0-pinned workspace, destructively rewriting `pnpm-lock.yaml`/`pnpm-workspace.yaml`/`package.json` (strips the `overrides` and the `react-native-css` patch). The shell script is pure bash and needs no pnpm. If it ever happens: `git checkout -- package.json pnpm-workspace.yaml pnpm-lock.yaml`.
