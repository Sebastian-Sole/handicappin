# Synthesis: public-contract-shape

**Date:** 2026-07-20
**Panel:** white-hat, red-hat, black-hat, yellow-hat, green-hat, blue-hat, pre-mortem
**Verdicts:** 5 agree, 2 mixed (black-hat, pre-mortem)
**Result:** CONSENSUS — Option A accepted, with binding conditions absorbed from the critical reviews.

## Decision

Adopt **Option A**: hand-written, URL-path-versioned REST route handlers under
`app/api/v1/` with shared zod schemas, a service-layer extraction of
`submitScorecard` first, and an OpenAPI 3.1 spec generated from those same
schemas. No stack change. The fitness-app integration and the long-term
third-party surface are one artifact.

Options B and C are rejected on evidence no reviewer contested:

- **Option B (trpc-to-openapi):** single-maintainer fork whose predecessor died
  exactly at the last tRPC major boundary; the generator automates only the
  cheap part of the work while taking the public contract hostage to a
  dependency. Verified facts (one npm maintainer, alpha-only official
  alternative) stood up under white-hat reproduction.
- **Option C (typed tRPC client package):** refuted by the repo's own history —
  `apps/native/lib/api/client.ts` documents that even the same-monorepo native
  app could not type-import `AppRouter` and fell back to an untyped client +
  zod. The premise fails in the easiest possible case.

## Why the two "mixed" verdicts do not break consensus

Black-hat and pre-mortem both accept Option A as the contract shape. Black-hat:
"the real project is the extraction, not the handlers." Pre-mortem: "Option A
itself survives the pre-mortem — the failure traces to items the recommendation
demoted to bullets." Their must-address items are conditions on how Option A
ships, and every one of them is absorbed below. No reviewer holds a fundamental
objection to the shape itself.

## Binding conditions (absorbed from the panel)

Ordered roughly by sequence, not importance. These are part of the decision,
not suggestions.

### Gate 0 — feasibility, before any contract code

1. **Prove the cookie-less prod path end-to-end.** Deploy a stub
   `/api/v1/health` and hit it with a bearer curl from outside. Two ways to
   clear the Cloudflare/Vercel challenge, decide explicitly between them
   (green-hat's alternative vs the default):
   - a **dedicated API hostname** (`api.handicappin.com`, gray-cloud/DNS-only
     to Vercel) — structurally immune to the challenge, isolates the API, and
     keeps a future separate-deployment option open; or
   - a **path-scoped bypass rule** for `/api/v1/*` through BOTH layers — the
     fragile version (unversioned dashboard state; this repo has already been
     burned by silent challenge-mode config).
   Whichever wins: document the rule in-repo and add a **scheduled cookie-less
   synthetic check** on `/api/v1/*` that alerts on 429/HTML. This gate applies
   to all options equally; if neither works, the hosting topic reopens.
2. **Confirm the fitness app's actual day-1 endpoint list** from the consumer
   (same developer — trivially obtainable). The "4–6 endpoints" figure is an
   assumption; scope v1 to demonstrated needs (POST /rounds + the reads the
   fitness app actually makes), not speculation.
3. **Decide this topic jointly with the external-auth-model sibling topic.**
   The spec's Authorization section cannot ship as TBD, and documenting "send
   your raw Supabase access token" now would bake in the exact
   second-migration cost that killed Option C. Either land the auth decision
   in the same gate or mark v1's Authorization section explicitly provisional.
4. **Owner affirms the platform bet.** The recommendation assumes the fitness
   integration and a future third-party platform are the same surface — that
   is a bet, not a requirement. If a genuine third-party API is deprioritized
   12+ months out, the cheapest honest baseline is C-prime (fitness app copies
   the native app's untyped superjson client + zod facade, zero server work)
   and Option A is premature. C-prime is hereby recorded and dismissed
   *conditional on the owner affirming the bet*.

### PR 1 — the extraction, before any REST handler

5. **Extract `submitScorecard` (round.ts:303) as its own PR** into a
   **location-agnostic service with no Next.js imports**, keeping Edge
   Function / separate-deployment doors open. This is 80% of the effort and
   95% of the risk (billing gating, pending-course creation, transactional
   handicap recalc), and its review sets the pattern every future endpoint
   follows.
6. **Characterization tests first:** golden round fixtures → expected handicap
   index around the existing behavior BEFORE moving code; rewire the tRPC
   procedure to the extracted service in the same PR. No REST handler may
   contain gating or business logic. This repo's recent history (shot-level
   stats phantom-migration 500s, Ballerud data defect) is the argument.

### The v1 contract itself

7. **Idempotency on POST /rounds from day one** (Idempotency-Key with response
   replay, or client round UUID + unique constraint, designed into the service
   seam). Mobile retries that double-create rounds corrupt the handicap — the
   product's core artifact — and retrofitting idempotency onto a published
   contract is itself a breaking change.
8. **Upstash rate limiting on every `/api/v1/*` route**, wired in the same PR
   that creates the route. The challenge bypass removes the bot shield from
   exactly the endpoints that mutate billing-gated state.
9. **One central error mapper** (TRPCError/service errors → RFC 9457
   problem+json) with a small, closed, append-only code set, so internal
   errors cannot leak into the public taxonomy.
10. **CI spec parity gate:** the OpenAPI spec is regenerated from the handlers'
    zod schemas and CI fails on diff. Hand-assembled specs drift into lying
    docs. Also verify what zod 4 `z.toJSONSchema` actually emits for
    `scorecardSchema` — refinements (e.g. putts+penalties ≤ strokes−1) do not
    serialize, so document those rules explicitly rather than promising the
    spec captures them.

### Ops package — right-sized (panel amendment to the recommendation)

11. **Keep the structural parts:** `/v1` path versioning (the convergent norm
    of the target fitness-API domain — WHOOP/Oura/Strava), problem+json
    envelope, stable append-only error codes, a changelog file, the CI-parity
    spec.
12. **Defer the ceremony:** the written 12-month deprecation policy and RFC
    9745/8594 Deprecation/Sunset header machinery wait until a consumer the
    developer does not own exists. Four of seven reviewers converged on this;
    keep it as an internal commitment in a drawer, publish it the week a real
    stranger integrates. (This is the one place the panel overrides the
    research recommendation's "minimum ops package".)

## Dissent (strongest surviving counter-position)

Blue-hat + green-hat: if the third-party platform goal is not real on a
~12-month horizon, the cheapest correct move is **C-prime / the bridge** —
ship the fitness app immediately on the proven untyped-client + zod pattern
(zero server work), and build /v1 only when a genuine external consumer
appears. Two migrations are cheap when both sides are the same developer and
the surface is 1–2 calls. This position loses only if the owner affirms the
platform bet (condition 4) — which is why that affirmation is a gate, not a
formality.

## Sequencing summary

1. Gate 0: challenge-bypass spike (hostname vs rule) + fitness endpoint list +
   joint auth-model decision + owner affirms platform bet.
2. PR 1: characterization tests + `submitScorecard` extraction to a
   framework-free service; tRPC rewired.
3. PR 2+: `/api/v1` handlers (idempotent POST /rounds first), rate limiting,
   error mapper, spec + CI parity, synthetic canary — each in the PR that
   creates the surface it protects.

## References

- Research: `docs/research/api-platform/topics/public-contract-shape/research.md`
- Panel reviews: `docs/research/api-platform/topics/public-contract-shape/reviews/`
