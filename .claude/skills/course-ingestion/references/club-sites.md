# Extracting from a Course's Own Website

Club sites are authoritative but inconsistent. This is agent work, not a fixed recipe — `agent-browser` handles navigation + rendering; you interpret whatever the page gives you. Re-read the rendered page each time; never hardcode a club's selectors.

## Find the site + the data

1. `WebSearch "<course name> golf official site scorecard"` and `"<course name>" slope rating`.
2. Confirm it's the official club site, not an aggregator.
3. Find the scorecard/rating page. Common spots: nav items "Course", "The Course", "Scorecard", "Visitors" / "Green Fees", "Slope" / "Course Rating"; URL paths `/scorecard`, `/course`, `/the-course`, `/slope`.

## Read whatever form it's in

- **HTML table** → `agent-browser eval` over the table(s), same idea as `extraction.md`. Work out which columns/rows are par, stroke index, and each tee's per-hole distance.
- **Slope/rating table only** (ratings + totals, no hole-by-hole) → take the ratings; get the hole grid from GolfPass as a fallback, then reconcile.
- **PDF or image scorecard** (very common) → `agent-browser download @ref ./card.pdf`, then read it (WebFetch for a PDF, or a vision pass). If it's unreadable, fall back to GolfPass and note it.

## Per-country notes

- **Norway**: distances are METERS (do not assume yards). Labels: herre = men, dame = women.
- **UK/Scotland**: WHS slope tables are standard; distances in YARDS. Tee colour → gender is convention, not guarantee — confirm.

## Then

Map into the raw contract (`contract.md`), **confirm the distance unit**, run the pipeline, and have the `course-data-validator` agent cross-check against the page.

## Gotchas

- Marketing prose rounds and misstates — trust the scorecard / WHS table, not the copy.
- If the club site and GolfPass disagree on a rating, the **club site (authoritative) wins** — flag the discrepancy in the report.
- A club site may list more tees than it gives hole-by-hole data for (same gap as GolfPass) — emit the detailed tees, report the rest.
