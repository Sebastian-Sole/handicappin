# Synthesis: billing-and-metering

Date: 2026-07-20 · Panel: 7 perspectives (white/red/black/yellow/green/blue hats + pre-mortem)
· Research: `research.md` (repo @ d06c827)

## Verdict: CONSENSUS — adopt the recommendation, with conditions

Verdict tally: 4 agree (white, yellow, green, blue), 3 mixed (red, black, pre-mortem). All
three mixed verdicts explicitly endorse the core metering choice; their objections target
*sequencing* — hard dependencies demoted to "follow-ups" — not the decision. Weighing
arguments rather than counting votes, the panel substantively converges.

## The decision

**API-submitted rounds count against the user's existing lifetime-25 free tier, identically
to web/native rounds (Option 1), with zero metering changes.** This is correct by
construction: both counting sites (`utils/billing/access-control.ts:39-51` and the race
re-check in `round.ts:949-992`) are unfiltered per-user row counts, so API rounds inherit
metering, limits, and rollback automatically. Exempting or separately metering API rounds
(Option 2) would leak the paid feature through the new door and require edits in both
counters plus the rollback plus a discriminator column. No perspective defended Option 2 or 3.

**Confidence is split, per the blue hat** (the panel's one structural correction to the
research's blanket "high"):

| Component | Confidence | Status |
|---|---|---|
| Metering-identical (Option 1) | High | Lock now; reversible later via the attribution column |
| `round.submitted_via` column + `round_submitted` platform property | High | Lock now; near-zero-regret, can never be backfilled |
| Machine-readable errors (RFC 9457 `plan_required` / `round_limit_reached` + quota headers at 10/5) | High on principle | Spec after the quarantine question (gate B below) |
| Provisioning **mechanism** (where the explicit provisioning step attaches) | Conditional | Depends on `external-auth-model` topic; only the *invariant* is locked |

The locked invariant on provisioning: **explicit, idempotent, consent-anchored provisioning
(profile row if missing + `plan_selected='free'` + billing_version bump + PLAN_SELECTED
event) — never a silent null→free default inside `submitScorecard`.** All seven perspectives
accept this invariant; where it attaches is decided by the auth topic.

## Conditions absorbed from the critical reviews

These are shipping gates and launch prerequisites, not open debates. Red, black, yellow,
green, and pre-mortem independently raised #1; green and pre-mortem independently raised #2.

1. **RLS insert side door is a shipping gate, not a follow-up.** The `round` insert policy
   (`db/schema.ts:292-297`; migration 20251011094523) lets any bearer token insert rounds via
   PostgREST, bypassing plan gating, the 25-round limit, and `submitted_via` stamping. Tokens
   on user devices will be extracted. Close it (or consciously accept it in writing) **before
   any token-bearing second app goes live**. Route the finding to the `api-ingress-and-abuse`
   topic with an owner and that decide-by point. Green's framing is the preferred fix shape
   to evaluate first: a DB-level check (BEFORE INSERT trigger or security-definer path)
   closes the side door AND can replace the manual race-rollback with one enforcement
   mechanism. If the fix requires a security-definer insert path, validate it against this
   design before implementation.

2. **Idempotency is a launch prerequisite, not an open question.** A background-sync client
   retrying a slow submission creates duplicate rounds; under lifetime row-count metering
   each duplicate burns quota and corrupts the handicap record. Add an `external_id` (or
   `submission_meta` jsonb) dedupe key with a per-user+client unique index **in the same
   migration as `submitted_via`**.

3. **The race-rollback's fate is decided at pipeline extraction, not after.** The post-hoc
   non-transactional delete sequence (`round.ts:949-992`) is nearly dormant under human
   traffic but becomes live under API batch-backfill concurrency — nondeterministic round
   deletion, and corrupted handicaps if a delete partially fails. The extraction spec must
   include an in-transaction limit check (advisory lock or serializable count) replacing the
   post-hoc rollback, or an explicit written reason it is safe.

4. **`submitted_via` is rescoped to analytics/attribution only** until a client registry
   exists and the side door is closed — it is self-reported and worthless for forensics or
   kill-switches before then. Null semantics decided now: null = pre-column legacy rows
   only, which is only a safe backfill policy once condition #1 is met. Day one the value is
   effectively hardcoded `api:fitness`; say so, and defer the `api_clients` registry until a
   real third-party consumer exists (as recommended).

5. **The Cloudflare/Vercel challenge-mode bypass for non-browser clients must be scheduled
   before any error-contract work matters** — prod currently 429s every cookie-less request
   with an HTML challenge page (dashboard fix, routed to ingress/hosting topics). Corollary
   (yellow hat): verify the `upgrade_url` deep link works end-to-end from inside the fitness
   app — through the challenge and without a sessionless login wall — before the first
   consumer ships.

6. **Provisioning must ship in the same milestone as the endpoint**, keyed to the auth-topic
   decision, with an auth-decision-independent fallback pinned now (e.g. an explicit
   `POST /v1/profile/provision`) so a shared-project/no-link-screen auth outcome doesn't
   orphan the step. Implementation details: `billing_version` writes must follow the
   `profile-billing-write.ts` pattern (it participates in an RLS expression,
   `db/schema.ts:87`); machine-originated PLAN_SELECTED events must be segmented out of
   onboarding funnels; the link/consent screen's disclosure and EARLY100 applicability must
   be specified.

7. **Server-side warning channel + day-one instrumentation.** Limit warnings must not depend
   solely on the fitness app honoring the header contract — add e.g. email at the existing
   10/5 thresholds. Instrument `plan_required` / `round_limit_reached` error rates from day
   one: the wall→upgrade conversion assumption is untested, and sync-toggle-off is the
   plausible failure mode.

## Owner gate decisions (decide before specs lock; neither flips Option 1)

**A. Free-tier shape.** Is lifetime-25 still the intended free tier once rounds arrive
automatically from an integration? Blue calls this the biggest buried answer-flipper; red
warns not to let the first angry fitness-app user decide it. Reshaping (e.g. per-year)
changes Option 1's UX cost and the warning-header design, but not the count-based mechanics.
Owner product decision, named gate before the error contract and warning thresholds lock.
Input to obtain first (white hat): the actual distribution of free-user round counts from
prod/PostHog — "~6 months to hit 25" is currently an assumption.

**B. Accept-and-quarantine: explicit yes/no.** Green's fourth option — store over-limit API
rounds but exclude them from handicap/counts, unlocking on upgrade — was never considered by
the research. It changes what `plan_required`/`round_limit_reached` responses even mean, is
arguably a stronger cross-product upgrade funnel ("12 rounds waiting") than a 403 +
`upgrade_url`, and deletes the destructive race-rollback. It must get a deliberate yes/no
before the error contract is spec'd, so hard-reject specs aren't written and then redone.

**C. Provisioning mechanism (largely delegated to the auth topic).** Link-time provisioning
vs green's simpler alternative — default `plan_selected='free'` at profile creation (trigger
or edge function + backfill), which makes the provisioning step, the native mock free-button
fix, and the "Please select a plan" branch all unnecessary by making the null-plan state
unrepresentable. Decide alongside/before the auth topic locks its consent flow.

## Dissent (strongest surviving counter-position)

Green's accept-and-quarantine (gate B) is the only surviving position that would materially
change a component of the recommendation — it replaces the hard-reject error contract for
over-limit rounds with deferred acceptance. No perspective champions it as *the* answer, but
it was never evaluated and is cheaper to consider now than after the REST error contract
ships. Secondary: the black hat maintains that provision-at-link manufactures billing state
for users whose intent was only "let my fitness app save scores," with the lifetime-25 trap
detonating months later inside a product this codebase doesn't control — absorbed via
conditions #6–#7 and gate A, but it stands as the reason gate A should not be rubber-stamped.

## Cheap verifications before implementation planning (white/blue hats)

- Does the `enqueue_handicap_calculation` trigger fire on direct PostgREST inserts?
  (local-stack test — informs condition #1's urgency)
- Read `apps/native/app/onboarding.tsx` to confirm native truly cannot set
  `plan_selected` (the provisioning step is partly billed as fixing this).
- Re-verify supabase/auth#2408 (hosted consent path) — citation is 4 months stale and shapes
  where provisioning attaches.
- Cross-check the `golf-api-landscape` sibling topic before treating Strava (N=1) as settled
  precedent; the decisive argument is internal (don't leak the paid feature) either way.
- Note: research miscited `access-control.ts` path — it lives at `apps/web/utils/billing/`,
  not `server/api/lib/`. Race-rollback deletes use the Drizzle `db` connection, not a
  service-role Supabase client.

## Cross-topic routing

| Item | Routed to | Decide-by |
|---|---|---|
| RLS insert side door | api-ingress-and-abuse | Before bearer tokens leave first-party hands |
| Cloudflare challenge bypass | api-ingress-and-abuse / hosting-stack-decision | Before first API call from the fitness app |
| Provisioning attachment point | external-auth-model | Before this topic's provisioning spec |
| Idempotency / external_id semantics | scorecard-write-semantics (shared migration with submitted_via) | Same migration |
| Strava precedent cross-check | golf-api-landscape | Before final synthesis |
