# Course Data Sources

Priority: **the course's own website first, GolfPass as a fallback.** Club sites are authoritative (GolfPass has known data-quality errors) and usually publish the *full* per-tee scorecard; the cost is that every club presents data differently, so extraction is layout-adaptive — which is exactly what an agent + `agent-browser` is for. No paid APIs.

Geographic priority: **Norway + Scotland/UK first.**

## Sourcing policy (strict — set by the project)

- **Ratings / slope / par**: authoritative from the **club's own site**. Capture every tee × gender (Herrer/Damer).
- **Per-hole grid (par, stroke index, distances)**: club's own scorecard first → else **GolfPass** → else the course is **not supported** (log `no_data`, skip). Use ONLY these two sources for per-hole numbers; never AllSquare / Golfify / other aggregators, and never blend or interpolate.
- **Complete-only**: emit a tee only if it has a full 18-hole grid; a course needs at least the primary men's + women's tee complete, else skip. No partial / ratings-only tees.
- **9-hole → expand to 18** (`isNineHole:true`). **Fewer than 9 holes (6-hole, etc.) → not supported.**
- **Discrepancies**: the club value wins; flag the disagreement in the report.

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
