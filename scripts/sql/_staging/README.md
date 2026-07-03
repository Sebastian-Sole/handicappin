# Staged course-ingest SQL

Per-course SQL files emitted by the "course-ingest" generator (which lives outside this
repo). Each file is a self-contained `do $$ ... $$` block inserting one course plus its
tees and holes, `pending` by default.

- `pnpm load:courses` applies every file here idempotently: a file is skipped when its
  course already exists by the `(name, country, city)` unique key, and loaded rows are
  marked `source='ingest'` for provenance. Connection: `DATABASE_URL`.
- `--dry-run` lists what would load/skip without executing (works without a DB).
- `--approve` also approves the courses/tees loaded in that run — the default `pending`
  keeps ingested data invisible to users until an operator reviews it.
