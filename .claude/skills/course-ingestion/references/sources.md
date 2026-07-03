# Course Data Sources

Priority: **the course's own website first, GolfPass as a fallback.** Club sites are authoritative (GolfPass has known data-quality errors) and usually publish the *full* per-tee scorecard; the cost is that every club presents data differently, so extraction is layout-adaptive — which is exactly what an agent + `agent-browser` is for. No paid APIs.

Geographic priority: **Norway + Scotland/UK first.**

## Sourcing policy (strict — set by the project)

The source priority is **country-aware** (see the country blocks below). Common rules:

- **Complete-only**: emit a tee only if it has a full 18-hole grid; a course needs at least the primary men's + women's tee complete, else skip. No partial / ratings-only tees.
- **9-hole → expand to 18** (`isNineHole:true`). **Fewer than 9 holes (6-hole, etc.) → not supported.** For a regulation 9-hole course `courseRating18` is the **18-round** rating (a regulation course's 18-round CR is ~62–74; a bare ~26–34 figure is the *9-hole* rating in the wrong field — the `ratings:suspect-18-field` WARN flags this). A par-3 course legitimately has a low CR.
- **Corroborate before you stage**: never emit a tee whose existence or numbers rest on a single page. A tee/par/rating must agree across **≥2 sources**; if they disagree, the authoritative source (below) wins and you flag it. This is what kills the "phantom Blue tee from a different course" and the stale-PDF errors.
- **Source hygiene** (check every source before trusting it):
  - **Stale**: reject a club PDF/scorecard older than ~2 seasons if a current WHS rating exists — routings change (holes added/removed, par re-rated).
  - **Parked/squatted domain**: if the club URL serves casino/spam/parking instead of a golf site, discard it and source by name from the WHS databases + GolfPass.
  - **9-hole-in-18-field**: a regulation course with `courseRating18 < 55` is almost always a 9-hole figure mis-stored — fix to the 18-round value.

### Norway

Club site first (many on `golfbox.no`), **GolfPass** fallback for the per-hole grid; no other aggregators. Distances in **meters**. (Unchanged — this works well for Norwegian clubs.)

### UK / Scotland — WHS-first

Scotland has a national WHS course-rating database the small clubs don't reproduce well on their own sites (stale PDFs, JS-only cards, parked domains), so **lead with the WHS data**:

- **Ratings / slope / par / stroke-index**: from the **authoritative WHS data** — Scottish Golf course rating / **coursehandicap.com** / **BlueGolf** (`course.bluegolf.com`) / **golfify.io** — cross-checked across **≥2** of them. Capture every tee × gender. These mirror the national WHS database and are more current/reliable than a small club's own page.
- **Per-hole distances**: the **club's own current scorecard** is best (clubs are authoritative for yardages); else the WHS-source scorecard; else GolfPass. Distances in **yards** — confirm.
- **Existence + location**: confirm the course is in Scotland from the club site (geo-check); if it's actually England/Wales/NI/RoI, skip (`skipped_not_scotland`).
- **Discrepancies**: WHS/national source wins for ratings; the club card wins for distances; flag every disagreement.

## 1. The course's own website — PRIMARY

Authoritative ratings and usually every tee's hole-by-hole data. Layout varies wildly: an HTML scorecard table, a WHS slope/rating table, or a PDF/image scorecard. Adaptive strategy: `club-sites.md`.

- UK/Scotland: WHS slope/rating tables are standard post-2020, on "Course" / "Scorecard" / "Slope & Rating" pages. Distances in **yards**.
- Norway: distances in **meters**; many clubs run on `golfbox.no`. Look for "Slope" / "Course rating" / herre (men) / dame (women).

## 2. GolfPass — FALLBACK (proven, structured)

`golfpass.com/travel-advisor/courses/<id>-<slug>`. No login, no Cloudflare; the scorecard is two clean DOM tables. Best when the club site is missing, PDF-only, or incomplete. Recipe: `extraction.md`.

- Caveats: **occasional data-quality errors — always cross-check against the club site.** The hole-by-hole grid details only the *primary* men's tee and the *primary* women's tee (e.g. Blue + Red); other tees in the summary have ratings/totals but no per-hole data.
- ToS: scraping is against GolfPass's terms — low volume, throttle, cache, attribute.

## 3. Other fallbacks

- **BlueGolf** (`course.bluegolf.com/.../detailedscorecard.htm`): server-rendered detailed scorecards, international.
- **USGA NCRDB** (`ncrdb.usga.org`): authoritative US ratings; returns 403 to plain fetch → needs `agent-browser`.

## Cross-check oracle (not a primary source)

`golfcourseapi.com` — free, 50 req/day. Use only to verify a scraped rating/slope where it happens to have the course.
