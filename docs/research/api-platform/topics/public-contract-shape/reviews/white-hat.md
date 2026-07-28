# White Hat Review — public-contract-shape

Perspective: facts and information only. Claims below were independently re-verified on 2026-07-20 against the repo and the npm registry.

## Claims verified (independently reproduced)

| Claim in research | Verification | Status |
|---|---|---|
| tRPC v11.10.0 + superjson ^2.2.6 + zod ^4.3.6 | `apps/web/package.json` | VERIFIED |
| Bearer-token auth with RLS scoping exists and is reusable | `apps/web/server/api/trpc.ts` — `extractBearerToken`, `getUserFromBearerToken`, `createBearerTokenSupabaseClient`; cookie auth first, bearer fallback | VERIFIED |
| `submitScorecard` at `round.ts:303` | `apps/web/server/api/routers/round.ts:303` (`submitScorecard: authedProcedure`), file is 1,117 lines | VERIFIED |
| 11 routers | `apps/web/server/api/routers/` contains exactly 11 files | VERIFIED |
| Native app consumes API untyped + zod | `apps/native/lib/api/client.ts` header comment documents exactly the claimed rationale: colliding `@/*` aliases, isolated pnpm dep graphs, `createTRPCUntypedClient<AnyRouter>`, zod at the trust boundary, decision logged in `docs/native-implementation-log.md` | VERIFIED |
| Input schemas importable outside the router | `scorecardSchema` lives in `apps/web/types/scorecard-input.ts` (shared, exported, unit-tested) | VERIFIED |
| trpc-to-openapi v3.3.0 published 2026-05-22 | npm registry: latest = 3.3.0, published 2026-05-22T16:29Z | VERIFIED |
| ~239k weekly downloads | npm downloads API: 239,173 for 2026-07-13→19 | VERIFIED (exact) |
| Peer deps `@trpc/server ^11.1.0` + zod 4 | npm: `@trpc/server ^11.1.0`, `zod ^3.25.0 \|\| ^4.0.0`, `zod-openapi ^5.4.4` | VERIFIED |
| Single-maintainer fork | npm maintainers list: exactly one (`mcampa`) | VERIFIED |
| Official `@trpc/openapi` exists, alpha-only | npm dist-tags: `latest: 11.18.0-alpha` (2026-06-17), no stable release ever | VERIFIED |
| Prod 429 challenge on cookie-less requests | Established in project memory (`vercel-challenge-mode-breaks-trpc`), root cause documented; dashboard-side fix | VERIFIED (prior session evidence) |

## Claims plausible but not independently re-verified here

- `@trpc/openapi` being "spec-only with RPC-shaped paths (`?input=`, superjson envelope)" — consistent with its alpha docs as summarized in the research file; not re-tested against the package itself.
- WHOOP v1→v2, Oura v2, Strava v3 all using URL-path versioning — consistent with general knowledge of those APIs; not re-fetched from their docs this pass.
- RFC 9457 (problem+json), RFC 8594 (Sunset), RFC 9745 (Deprecation header) exist and say what is claimed — RFC numbers are correct as cited; 9745 was published March 2025, so it is recent but real.
- "trpc-openapi (the predecessor) was abandoned exactly at the tRPC v11 boundary" — not re-checked; the fork's existence and the original's staleness make it plausible.

## Factual discrepancies found (minor)

1. **Router line count**: research says "~3,474 lines"; `wc -l` over `apps/web/server/api/routers/*.ts` gives **3,195**. The delta likely includes `root.ts`/`trpc.ts` or drifted since research. Not material to any conclusion.
2. "router zod input schemas are already exported" is true for the schema that matters (`scorecardSchema` in `types/scorecard-input.ts`), but was spot-checked for one schema only, not all 11 routers.

## Evidence structure of the recommendation

- The case **against Option C** rests on first-party repo evidence (the native client's own documented failure to type-import `AppRouter`). This is the strongest kind of evidence available and it is accurately quoted.
- The case **against Option B** rests on two verified facts (single maintainer; predecessor died at a major boundary) plus one argument that is *reasoning*, not fact: "the expensive work is manual anyway." That argument is well-supported by trpc-to-openapi's documented requirement for `.meta({openapi})` + `.output()` per procedure, but the *magnitude* of the residual savings (handler rendering + spec assembly) was not measured.
- The case **for Option A** correctly notes zero new runtime dependencies and repo-convention fit. The claim that "maintenance-doubling collapses to two thin adapters" is a design projection, not an observed fact — it depends on the service extraction actually happening and staying the single home of logic.

## Data still missing (obtainable before locking)

1. **Fitness-app endpoint requirements** — the 4–6 endpoint list is a guess; the consumer is the same developer, so the real launch list is obtainable by simply asking. This determines extraction scope (open question in the research itself).
2. **Cloudflare/Vercel bypass mechanics** — no evidence yet that a path-scoped bypass rule for `/api/v1/*` is actually configurable in the current Cloudflare-in-front-of-Vercel setup (two layers may each challenge). This is testable today with a curl against a staging rule and is flagged day-0 blocking by the research; it remains unverified that the fix works, only that the problem exists.
3. **zod 4 `z.toJSONSchema` fidelity** for the specific schemas involved (`scorecardSchema` has refinements like putts+pen ≤ strokes−1; refinements do not serialize to JSON Schema). Whether the generated OpenAPI honestly represents validation is checkable locally in minutes.
4. **`submitScorecard` extraction cost** — "~700 lines inline" was asserted in the prior assessment; the procedure sits in a 1,117-line file. An hour of reading would bound the extraction risk (transaction boundaries, Sentry tags, billing gating coupling).

## Verdict

The factual foundation of the recommendation is unusually solid: every checkable load-bearing claim reproduced exactly (including the 239k download figure and the single-maintainer status). The remaining gaps are forward-looking unknowns the research itself flags, not contradicting evidence. On the evidence, Option A is the option whose risks are least dependent on unverified external facts.
