# Browser Extraction Recipe (GolfPass via agent-browser)

Proven against `golfpass.com`. `agent-browser` drives Chrome over CDP; the daemon persists between commands.

> For parallel/batch runs, prefix every command with `--session <course-slug>` to isolate the browser (see `batch.md`). A single run can use the default session (shown below).

## Steps

1. **Find the URL**: `WebSearch "<course name> golfpass.com travel-advisor courses"`. Confirm city/country before trusting a match.
2. **Open + wait** (use `domcontentloaded`, not `networkidle` — GolfPass keeps connections open and `networkidle` hangs):
   ```
   agent-browser open "<url>"
   agent-browser wait --load domcontentloaded
   ```
3. **Confirm access** (no login/challenge): `agent-browser get title` and `agent-browser get url`.
4. **Enumerate tables**:
   ```
   agent-browser eval 'JSON.stringify(Array.from(document.querySelectorAll("table")).map((t,i)=>({i,rows:t.rows.length,cols:t.rows[0]?Array.from(t.rows[0].cells).map(c=>c.innerText.trim()):[]})))'
   ```
   - `table[0]` = **Tees summary** (`Tee/Par/Length/Rating/Slope`), one row per tee; a `(W)` suffix on the tee name marks a women's rating.
   - `table[1]` = **Hole grid** (`Hole/1..9/Out/10..18/In/Total`): rows are per-tee distances (e.g. `"Blue M: 74.0/133"`), a `"Par"` row, a `"Handicap"` row (men's SI) and a `"Handicap (W)"` row.
5. **Dump the grid**:
   ```
   agent-browser eval 'JSON.stringify(Array.from(document.querySelectorAll("table")[1].rows).map(r=>Array.from(r.cells).map(c=>c.innerText.trim())))'
   ```
6. **Close**: `agent-browser close`.

## Mapping to the raw contract

- `pars` ← the `"Par"` row (drop the Out/In/Total columns).
- `strokeIndexMen` ← `"Handicap"` row; `strokeIndexWomen` ← `"Handicap (W)"` row (drop the blank Out/In/Total cells).
- per tee in the grid: `name` + `gender` (`M`→`mens`, `W`→`ladies`), `courseRating18`/`slopeRating18` ← `"74.0/133"`, `distances` ← the 18 hole columns.
- `distanceMeasurement`: GolfPass shows `yards` in the summary Length — **confirm**, because Norwegian courses may be listed/played in meters.
- A tee in the summary but absent from the grid has no per-hole distances → emit only the fully-detailed tees and report the rest as a gap.

## Gotchas

- Selector syntax is `@ref` (from `snapshot -i`), not Playwright's `text=`. For tabular data, `eval` is the most robust extractor.
- `agent-browser get text "table"` returns only the **first** table — use `eval` to index `table[1]` for the hole grid.
- Re-snapshot after any navigation/DOM change; refs go stale.
