# Batch Ingestion Report

## Re-pilot (strict sourcing rules) — `wf_f08c40a8-41d` · 6 courses · ~493k tokens · ~22 min

| # | Course | Status | Validator | Recommendation |
|---|--------|--------|-----------|----------------|
| 2 | Alta Golfklubb | staged_with_warnings | needs-review | promote w/ acknowledgment (Rød grid unverifiable; GolfPass-sourced grid + fabricated nine are policy-OK) |
| 29 | Florø Golfklubb | **no_data** | — | skip — 6-hole course, not supported |
| 58 | Hovden Golfklubb | staged_with_warnings | needs-review | promote after fetching the club's Damer slope PDF; **back-9 distances overstated** (9 holes / 18 tees, back-9 not published) |
| 85 | Molde Golfklubb | staged_with_warnings | needs-review | confirm ratings on the JS slope page, then promote (par 70, 18 real holes, all from club site) |
| 134 | Stavanger Golfklubb | staged_with_warnings | needs-review | **promote** — club 2024 PDF confirms all 8 tees; GolfPass was stale/yards. (2 men's slopes read off a PDF image — spot-check) |
| 13 | Bleik Golfstrømbane | not_found | — | no website |

**Outcome: 0 fail · 4 staged (all validator-recommended promote/promote-with-check) · 1 clean skip · 1 not-found.** Big improvement over pilot 1 (which had 2 fails). Strict rules (club-authoritative ratings, GolfPass-only grid fallback, complete-tees-only, 9→18, sub-9 unsupported, discrepancy→club+flag) eliminated the hard failures.

Staged candidates awaiting your review: `alta_golfklubb.sql`, `hovden_golfklubb.sql`, `molde_golfklubb.sql`, `stavanger_golfklubb.sql`.

## Residual caveats (apply to the full run)

1. **9-holes-with-18-different-tees** (Hovden): if the club publishes the alternate back-9 distances (Molde does), we capture them accurately; if only front-9 is available (Hovden), the 18-hole expansion overstates distance. Flagged per course.
2. **PDF-image rating reads** can be "medium confidence" (Stavanger tees 52/46) — spot-check before promoting.
3. **JS-gated club pages**: the validator now must use agent-browser (not WebFetch) — strengthened after Molde.
4. **Women's stroke index** is rarely published separately → falls back to men's (flagged).

## Full-run scope

- 165 listed · **34 already in the seed** · 5 not-found → **~125 new courses** to ingest.
- Cost ≈ ~98k tokens/course → ~12M tokens; several hours. **Run in batches (~25–30) with review between**, not one job.

---

## Batch 1 (#1–57) — `wf_56c1fa3e-fcc` · 30 courses · 3.24M tokens · ~2.2 hrs

⚠ **Validator verdicts here are PESSIMISTIC** — batch 1 ran before the WebFetch→agent-browser validator fix, so the validator could not render JS-gated club slope pages and flagged many ratings "unverifiable". Re-validate these with the agent-browser-only validator before trusting fail/needs-review.

- **no_data (5, skipped):** Alsten (6-hole), Frosta, Hardanger, Helgeland, Hitra.
- **pass (2):** Grini, Hof.
- **needs-review (15):** Arendal & Omegn, Bodø Golfklubb, Fet, Gamle Fredrikstad, Giske, Gjerdrum, Gjersjøen, Gjøvik & Toten, Grenland & Omegn, Grimstad, Haga, Halden, Harstad, Haugesund, Herdla.
- **fail (8) — re-check (likely validator artifact + some genuine):** Austrått (club DNS down → GolfPass-only, inconsistent), Bodø Golfpark (dup of Bodø Golfklubb, same site), Byneset, Eiker, Ekholtbruket, Hakadal/Aas Gaard, Hemsedal Golfalpin, Holtsmark.

All 25 staged in `_staging/` as pending. Detail: `tasks/wg7hkqtam.output`.

---

## Batch 2 (#60–99) — `wf_cba8a764-3ae` · 30 courses · 3.51M tokens · ~2 hrs · FIXED validator (agent-browser-only)

Verdicts now trustworthy (12 pass vs batch 1's 2 — the fix worked).

- **no_data (3):** Husøy (club DNS down + GolfPass empty), Lærdal, Namsos.
- **pass (12):** Jæren, Kjekstad, Krokhol, Lommedalen, Miklagard, Moss & Rygge, Namdal, Narvik, Nes, Nesfjellet, North Cape, Nærøysund.
- **needs-review (11):** Karmøy (validator says promote), Klæbu, Kristiansund, Kvinnherad, Larvik, Lillestrøm, Meland, Mjøsen, Mørk, Nordvegen, Norsjø.
- **fail (4, genuine):** Kongsvingers, Midt-Troms, Nordfjord, Norefjell.

Detail: `tasks/wqntt6r32.output`.

---

## Batch 3 (#100–132) — `wf_3bf4c6b5-07e` · 30 courses · 3.73M tokens · ~2.6 hrs

- **no_data (4):** Odda (site down + GolfPass empty; course closed 2023), Rjukan, Selbu, Smøla.
- **pass (6):** Nøtterøy, Ringerike, Sauda, Skei, Ski/Smerta, Skjeberg.
- **needs-review (14):** Oppegård, Oppdal, Preikestolen, Randaberg, Røros, Sandane, Sande, Sandefjord, Sandnes, Sirdal, Sola, Solum, Soon, Sorknes.
- **fail (6, genuine):** Ogna (Blå/Sort tee mix-up), Onsøy, Oustøen, Polarsirkelen, Rauma, Romerike.

Detail: `tasks/wp9wupghe.output`.

---

## Batch 4 (#133–165) — `wf_21435089-9e1` · 31 courses · 3.29M tokens · ~2.35 hrs

- **no_data (6):** Suldal, Sunndal, Tysnes, Veierland, Vesterålen, Vrådal.
- **pass (10):** Sotra, Stiklestad, Tingvoll, Trysil, Utsikten, Vanylven, Varanger, Volda, Voss, Ålesund/Solnør.
- **needs-review (12):** Stjørdal, Stord, Stranda, Sunnfjord, Sunnmøre, Tjøme, Trondheim, Tromsø, Tønsberg, Ullensaker, Valdres, Østmarka.
- **fail (3, genuine):** Steinkjer (par 62 vs 64 conflict), Surnadal, Øya.

Detail: `tasks/wv4fuqxnh.output`.

---

# ★ FINAL TRIAGE (all 4 batches + batch-1 re-validation)

**121 eligible → 103 staged, 18 no_data. Verdicts: 33 pass · 52 needs-review · 18 fail.** Run cost ~16M tokens.

## ✅ Promote-ready (33 — validator "pass")
#3 Arendal & Omegn, #34 Gjersjøen, #38 Grini, #50 Haugesund, #56 Hof, #62 Jæren, #65 Kjekstad, #72 Krokhol, #77 Lommedalen, #83 Miklagard, #86 Moss & Rygge, #88 Namdal, #90 Narvik, #91 Nes, #92 Nesfjellet, #98 North Cape, #99 Nærøysund, #100 Nøtterøy, #112 Ringerike, #120 Sauda, #124 Skei, #125 Ski/Smerta, #126 Skjeberg, #133 Sotra, #136 Stiklestad, #145 Tingvoll, #149 Trysil, #154 Utsikten, #156 Vanylven, #157 Varanger, #160 Volda, #161 Voss, #163 Ålesund/Solnør.

## ⛔ DEDUP — already in seed under a different name (do NOT promote as new)
- #18 Byneset → `byneset_golf_-_north_course.sql`
- #24 Eiker → `eiker_golfbane_-_portåsen_2018.sql` (old entry has swapped Gul genders — candidate to REPLACE)
- #25 Ekholtbruket → `ekholt_golfklubb_-_ekholtbruket.sql`
- #28 Fet → `fet_golfklubb_&_leikvin_golfpark.sql`
- #43 Hakadal/Aas Gaard → `hakadal_golfklubb_-_aas_gaard_golfpark.sql`
- #52 Hemsedal Golfalpin → `hallingdal_golfklubb_-_golfapin_golfbane_hemsedal.sql`

## ✖ Fail (18 — genuine issues; fix-and-restage or skip)
#25 Ekholtbruket, #36 Grenland, #37 Grimstad, #43 Hakadal, #52 Hemsedal, #68 Kongsvingers, #82 Midt-Troms, #93 Nordfjord, #96 Norefjell, #102 Ogna, #103 Onsøy, #107 Oustøen, #108 Polarsirkelen, #111 Rauma, #114 Romerike, #135 Steinkjer, #144 Surnadal, #165 Øya.

## ⊘ no_data (18 — dead domain / 6-hole / closed club)
Alsten, Frosta, Hardanger, Helgeland, Hitra, Husøy, Lærdal, Namsos, Odda, Rjukan, Selbu, Smøla, Suldal, Sunndal, Tysnes, Veierland, Vesterålen, Vrådal.

## Caveats
- Batch-1 re-validation hit intermittent agent-browser contention (5 concurrent) → a few verdicts are "unverifiable → needs-review"; re-run individually if needed.
- Universal: front/back-9 ratings are derived (fabricated) — no Norwegian club publishes per-nine; women's stroke index usually falls back to men's.
- 52 needs-review are mostly policy flags (GolfPass-sourced grid, fabricated nine) — many are effectively promotable on a quick glance; see per-batch sections.

## Promotion (per course)
`mv` the file from `_staging/` to `scripts/sql/`, re-run `course:ingest <raw.json> --approve --out scripts/sql`, then `bash scripts/build-seed.sh`.

---

## ✏️ User review overrides (2026-06-26)

- **#135 Steinkjer → PROMOTE-READY**: staged par 64 is correct; the WHS table's "62" was a typo. (women's SI = men's caveat remains)
- **#144 Surnadal → PROMOTE-READY**: staged par 66 is correct; "65" was a typo.
- **#25 Ekholtbruket**: user confirms staged par 4 is correct (existing seed entry `ekholt_golfklubb_-_ekholtbruket.sql` has par 3 — likely wrong) → DEDUP-REPLACE candidate, not a new insert.
- **#36 Grenland**: par 72 confirmed by user; OPEN: ratings differ from the June-2026 NGF PDF (Hvit 73.9/143 staged vs 73.2/145) — keep staged 2017 values or re-pull 2026?
- **Fix-and-restage launched** for: #37 Grimstad, #82 Midt-Troms, #96 Norefjell(*), #102 Ogna, #103 Onsøy, #107 Oustøen, #108 Polarsirkelen, #114 Romerike, #165 Øya. (*#96 assumed for "#98"; North Cape #98 actually passed.)

---

## 🔧 Fix-and-restage results — `wf_abf5fc9f-7e8` · 9 courses · 1.24M tokens

All 9 moved OUT of "fail":
- ✅ **pass**: #37 Grimstad (back-9 corrected), #103 Onsøy (meters + hole-2 par 5 corrected).
- ⚠ **needs-review** (core fix applied; residual policy/verify flags, mostly promotable): #82 Midt-Troms (validator: promote), #102 Ogna (Sort tee added), #107 Oustøen (meters + women's SI), #108 Polarsirkelen (ratings re-sourced), #114 Romerike (unit corrected).
- ⏸ **#96 Norefjell → HOLD**: nine-swap corrected, but the club domain is DNS-down so ratings are GolfPass-only — re-verify when the site is back online.
- ⊘ **#165 Øya → no_data**: no real per-hole source (club site down, GolfPass N/A) — reclassified; stale staged file removed.

### Remaining genuine fails (not yet addressed)
- #68 Kongsvingers (CR/slope off + dedup vs `kongsvinger_golfklubb.sql`), #93 Nordfjord (yards-as-meters; real site is norgolf.com), #111 Rauma (slopes off 4–7).
### Dedup-skip/replace
- #25 Ekholtbruket, #43 Hakadal, #52 Hemsedal (+ #68 Kongsvingers).

---

## 🔧 Fix round 2 — #68, #93, #111 — `wf_1907845e-841` · 0.38M tokens

- **#93 Nordfjord → FIXED**: unit corrected to meters from the real site (norgolf.com); validator says **promote**. (Slope tables valid thru 2025 — minor freshness note.)
- **#111 Rauma → ALREADY CORRECT (false alarm)**: re-fetch confirms the staged values (42m 64.2/121, 37m 62.8/116) match the *current* 2022 WHS PDF (valid to 2032). The original "fail" compared against the superseded 2016 scorecard. No change — promotable.
- **#68 Kongsvingers → data corrected** (Blue CR 69.5→69.9, Blue slope 134→135, Green-ladies slope 125→123) but remains a **DEDUP** of `kongsvinger_golfklubb.sql` → replace-or-skip decision.

**→ No genuine data-error fails remain.** Open items are human decisions only: dedup-replace (#25, #43, #52, #68) and #36 ratings.

---

# ✅ PROMOTED — 63 courses landed in the seed (2026-06-26)

Re-emitted as `approved` into `scripts/sql/` and `seed.sql` rebuilt via `bash scripts/build-seed.sh`. **Seed grew 47 → 111 courses.** 0 collisions with existing entries.

Still held in `_staging/` for your decisions (42 files): **9 dedup-replace** (#18,24,25,28,43,52,68,74,75), **~30 needs-fix/verify**, **#36** (ratings), and the **4 pilot candidates** (Alta, Hovden, Molde, Stavanger). Nothing here entered the seed.

---

## 🔁 Dedup replaces (9) — 2026-06-26
Promoted the new club-sourced version, retired the old seed entry (1:1 swap; seed stays 111):
#18 Byneset, #24 Eiker, #25 Ekholtbruket, #28 Fet, #43 Hakadal/Aas Gaard, #52 Hemsedal Golfalpin, #68 Kongsvingers, #74 Larvik, #75 Lillestrøm.
(Heads-up to spot-check on commit: #18 Byneset's new ratings differed notably from the retired entry — club-sourced values kept.)

---

## 🔧 Fix-and-restage 28 — `wf_df7693d3-594` · 3.15M tokens (~5 hrs; 5 agents stalled late = Chrome buildup)

Of 23 completed: **15 cleared → PROMOTED (seed 111 → 126).**
- **promoted (15):** #14 Bodø Golfklubb (now PASS, correct site bodogolfklubb.no), #31 Gamle Fredrikstad, #35 Gjøvik & Toten, #42 Haga, #47 Harstad, #71 Kristiansund, #73 Kvinnherad, #81 Meland, #87 Mørk, #95 Nordvegen, #96 Norefjell, #111 Rauma, #118 Sandefjord, #129 Sola, #131 Soon.
- **held needs-review (6):** #15 Bodø Golfpark, #33 Gjerdrum, #97 Norsjø, #102 Ogna, #114 Romerike, #116 Sandane.
- **fail (1):** #7 Austrått — par is 70 not 72 (2025 renovation changed 2 of holes 5/6/7); needs current per-hole pars.
- **no_data (1):** #132 Sorknes — per-hole grid provenance unconfirmable.
- **stalled (5) → re-running** (`wf_f42dd244-34c`): #143 Sunnmøre, #146 Tjøme, #147 Trondheim, #152 Tønsberg, #153 Ullensaker.

Promotion note: after the tmp dir aged out, promotion was done by flipping `pending`→`approved` in the staged SQL (repo-durable) rather than re-running the CLI from the tmp raw JSON.

---

## 🔧 Re-run of 5 stalled — `wf_f42dd244-34c` · 0.77M tokens (no stalls on fresh run)
4 cleared → PROMOTED (seed 126 → 130): #143 Sunnmøre, #147 Trondheim, #152 Tønsberg (pass), #153 Ullensaker.
Held: **#146 Tjøme** — "Dobbel Ni" (Double Nine) course; the back nine plays different distances + stroke indices than the front, but only front-9 is on GolfPass. Needs the club's per-hole Hullskilt-2025 images (Hull-1…18) — agent-readable but image-based.

---

# 🏁 FINAL — seed = 130 courses (started session at 47; +83 net)

Held in `_staging` (14), nothing entered seed without clearing validation:
- **#7 Austrått** — par is 70 (2025 renovation changed 2 holes); needs current per-hole pars.
- **#146 Tjøme** — Double-Nine back-9 (see above).
- **#132 Sorknes** — per-hole grid provenance unconfirmable.
- **#36 Grenland** — your ratings call (2017 staged vs 2026 PDF).
- **6 needs-verify** (#15 Bodø Golfpark, #33 Gjerdrum, #97 Norsjø, #102 Ogna, #114 Romerike, #116 Sandane) — each "promote once a human confirms one JS-gated rating page".
- **4 pilot candidates** — Alta, Hovden, Molde, Stavanger.

---

## ✏️ Staging resolution (2026-06-29) — seed 130 → 136
User reviewed the 14 held:
- **PROMOTED (6):** Gjerdrum, Molde, Sandane, Sorknes, Stavanger, + **Norsjø** (rebuilt from the club's scorecard image — prior staged values were wrong; 5 men's tees 62/57/52/48/32 + 4 women's 57/52/48/32, meters, par 72).
- **DELETED (5, unverifiable — "let a user submit it"):** Alta, Austrått, Hovden, Ogna, Tjøme.
- **RE-SOURCING (3):** Bodø Golfpark (SI swap + rating fix), Grenland (2026 NGF ratings), Romerike (GolfPass meters).
