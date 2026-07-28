# Blue Hat review — public-contract-shape

**Perspective:** process control. Was the right question asked, was the method sound, and what should the decision process be?
**Verdict:** agree (with process caveats that must be closed before lock).

## 1. Was this the right question?

Mostly yes — with one framing hazard. The topic bundles three distinct decisions:
(a) contract shape (REST vs tRPC-derived vs client package), (b) tooling
(trpc-to-openapi vs hand-rolled), and (c) the operational package. The research
handled all three, but the *driver* of the answer is a strategic assumption stated
as fact: "the fitness-app integration and the future third-party platform are the
same surface." That is a bet, not a requirement. Nothing in the brief establishes
that a third-party platform is committed — the owner's question was "can the current
stack host it," which is weaker. The recommendation survives this (Option A is also
fine if the platform never materializes, because the surface is tiny), but the
decision record should mark it as a bet so a future reader knows why A was chosen
over the cheapest same-developer path.

## 2. Method soundness

**Strong points, verified:**
- Codebase grounding is accurate. I spot-checked every load-bearing claim:
  `apps/native/lib/api/client.ts` header comment says exactly what the research
  quotes (AppRouter not type-importable, untyped client + zod); bearer helpers
  exist at the cited lines in `apps/web/server/api/trpc.ts` (`extractBearerToken`
  line 31, `getUserFromBearerToken` line 63, `createBearerTokenSupabaseClient`
  line 108); `submitScorecard` is at `round.ts:303`; `app/api/` contains exactly
  the "what tRPC can't serve" set.
- External evidence is dated, versioned, and primary-sourced (npm publish dates,
  download counts with the query week, RFC numbers with publication dates, the
  official `@trpc/openapi` alpha correctly distinguished from the community fork).
  This is well above the usual bar; the trpc-to-openapi maintenance question the
  topic asked was answered with specifics, not vibes.
- The prior-art survey (WHOOP/Oura/Strava path versioning vs Stripe date
  versioning) is the right comparison class — fitness-domain partner APIs, not
  hyperscalers.

**Method gaps:**
1. **The option space is slightly gerrymandered against C.** The research refutes
   C in its *weakest* form (publish a *typed* client package — already proven
   infeasible by the native app). But the *strongest* form of C was never
   enumerated: **C′ — the fitness app copies the native app's existing untyped
   superjson client + zod-facade pattern verbatim.** No package publishing, no
   type-graph problem, near-zero server work, and the pattern is already
   battle-tested in this repo. C′ still loses on the platform bet (unversioned
   internal contract as external dependency), but it is the true cheapest
   baseline, and refuting it — not typed-C — is what makes "high confidence"
   honest. As written, the strongest competitor was skipped.
2. **No cost quantification.** "Slightly more upfront code" (A) vs "fastest path"
   (B) vs "near-zero work" (C) are never sized, even roughly (days). For a solo
   developer the delta between A and C′ might be weeks vs hours; the decision may
   still be A, but the record should show the price that was knowingly paid.
3. **The migration-cost claim for C is asserted, not argued.** "Two migrations
   instead of one" assumes the fitness app's v1 needs are non-trivial; if launch
   scope is literally one endpoint (POST scorecard — open question 3), redoing it
   on the real surface later is an afternoon, not a migration.

## 3. Decision process — what should happen before lock

1. **Validate the Cloudflare/Vercel bypass NOW, not at ship time.** It is listed
   as a "day-0 blocker" for every option, which means it is actually a *pre-
   decision* feasibility check: if a path-scoped bypass rule cannot be made to
   work (orange-cloud + Vercel challenge interaction), every option's cost model
   changes (separate hostname, `api.` subdomain, different edge config). A
   30-minute dashboard experiment de-risks the whole program. Cheapest test with
   the highest information value; run it first.
2. **Sequence with the sibling `external-auth-model` topic.** The recommendation
   claims to be auth-agnostic, and largely is — but the choice between raw
   Supabase tokens vs API keys vs OAuth affects route structure (callback/token
   endpoints), the error taxonomy (`unauthorized` vs `invalid_key` semantics),
   and whether `/api/v1` handlers can reuse the existing bearer helpers unchanged.
   Lock contract shape and auth model in the same gate, not serially.
3. **Confirm the fitness app's actual day-1 endpoint list** (open question 3)
   before scoping the first PR. The 4–6 endpoint list is a guess; build A only
   for what the first consumer needs, and let the platform surface grow additively.
4. **Answer open question 4 narrowly**: extract only the submission pipeline in
   PR 1. Full `round.ts` decomposition is scope creep dressed as prerequisite.

## 4. What would change the answer

- If the third-party platform is explicitly deprioritized (fitness app is the
  only consumer for 12+ months), C′ becomes defensible and A becomes premature —
  the decision gate should ask the owner this question directly.
- If the v1 surface grows past ~10 endpoints with rapid churn, B's
  single-source-of-truth argument strengthens; revisit at that threshold.
- If the Cloudflare bypass proves impossible path-scoped, the hosting-stack topic
  reopens (separate API hostname), which could also reopen where handlers live.

## 5. Bottom line

The method was sound where it matters most — codebase grounding is verifiably
accurate, external claims are dated and primary-sourced, and the versioning/ops
research answers exactly what the topic asked. The recommendation (A) is robust:
it wins under the platform bet and is merely slightly over-built without it. Agree,
conditional on: (1) the C′ untyped-client variant being explicitly recorded and
dismissed in the decision doc, (2) the Cloudflare bypass being validated before
any build, (3) contract + auth being locked together, (4) v1 scope pinned to the
fitness app's confirmed needs.
