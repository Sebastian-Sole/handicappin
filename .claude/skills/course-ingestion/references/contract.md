# Raw Course Contract

The input a scraper/extractor produces. Intentionally looser than the app's `courseSchema` — it mirrors the scorecard, and `normalize.ts` derives the strict shape. Source of truth: `apps/web/scripts/course-ingest/contract.ts`.

## Shape

| field | type | notes |
|---|---|---|
| `name` | string | course name (3–100 chars after trim) |
| `city` | string | |
| `country` | string | e.g. `"Norway"`, `"Scotland"` |
| `website` | string? | scheme optional; the pipeline prefixes `https://` |
| `isNineHole` | bool | 9-hole cards carry 9 entries; expanded to 18 |
| `distanceMeasurement` | `"meters"` \| `"yards"` | **Confirm from the source** — Norway is usually meters |
| `pars` | int[] | course-level par per hole (9 or 18), shared across tees |
| `strokeIndexMen` | int[] | men's stroke-index allocation (9 or 18) |
| `strokeIndexWomen` | int[]? | falls back to men's if absent |
| `tees` | RawTee[] | one entry **per (name, gender)** |
| `approvalStatus` | `"pending"` \| `"approved"` | defaults to `"pending"` |
| `source` | `{provider, url?}` | provenance for the validator's cross-check |

### RawTee

`name`, `gender` (`"mens"` \| `"ladies"`), `courseRating18`, `slopeRating18`, optional **real** per-nine ratings (`courseRatingFront9`, `slopeRatingFront9`, `courseRatingBack9`, `slopeRatingBack9`), and `distances` (9 or 18 per-hole distances for this tee).

## 9-hole expansion

Front nine repeated for holes 10–18; back-nine stroke index = front + 1. Matches `scripts/parse_scorecard.py`.

## Derived — do NOT put in raw (the pipeline computes these)

`outPar`/`inPar`/`totalPar`, `outDistance`/`inDistance`/`totalDistance`, the per-tee `holes[]`, and the front/back-9 ratings when not supplied (when derived, the course is flagged `ratings:fabricated-nine`).

## Worked examples

- `apps/web/scripts/course-ingest/fixtures/ballerud.raw.json` — 9-hole, meters, single men's tee (par-3 course; exercises the range-warning + fabrication paths).
- `apps/web/scripts/course-ingest/fixtures/test-links-18.raw.json` — 18-hole, multi-tee, both genders, real per-nine ratings (clean run, zero findings).
