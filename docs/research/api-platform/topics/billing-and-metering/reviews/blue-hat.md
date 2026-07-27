# Blue Hat review — billing-and-metering

Perspective: process control. Was this the right question, was the method sound, and what should
the decision process be?

Verdict: **agree** with the recommendation, with process corrections that must be applied before
the decision is locked.

## 1. Method audit

**Codebase grounding: strong.** I spot-verified the load-bearing claims. The gate order and the
FORBIDDEN "Please select a plan" throw are exactly where cited
(`apps/web/server/api/routers/round.ts`, ~334-341). The free-tier check is a pure row count, so
the "zero metering changes" claim is structurally true, not asserted. The research also
*corrected* the prior assessment (found the no-profile-row case via the `create-profile` edge
function, and the native mock free-plan button) rather than inheriting it — that is exactly what
"verify in the repo, don't re-litigate blindly" should look like. One trivial miscite: the access
check lives at `apps/web/utils/billing/access-control.ts`, not `server/api/lib/` as the summary
implies. Cosmetic; the file and lines exist.

**Recency: mostly good, one stale pin.** Strava sources are stamped accessed 2026-07-20 and the
June-2026 policy change is captured. But `supabase/auth#2408` (hosted consent path) is cited "open
as of March 2026" — four months stale. That issue's status materially shapes where the
provisioning step can attach. Re-verify it in the auth topic before anything is locked.

**Prior-art breadth: N=1.** The entire external case rests on Strava. It is the right analogue,
and the decisive argument is actually internal (don't leak the paid feature through a side door),
so this doesn't flip the answer — but the write-up presents Strava as "the model" when it is one
data point. Garmin Connect's write API, HealthKit's write model, or GHIN would have been cheap
corroboration. The sibling topic `golf-api-landscape` should be checked for overlap before
synthesis treats Strava as settled precedent.

## 2. Was this the right question?

Mostly — but it bundles **three separable decisions with different reversibility and different
dependencies**, and then stamps a single "high confidence" on the bundle:

| Decision | Decidable now? | Reversibility |
|---|---|---|
| (a) Metering policy: API rounds count identically | Yes — it is literally the default behavior of the existing count | Reversible later via the very `submitted_via` column being added |
| (b) Attribution: `round.submitted_via` + analytics property | Yes — one nullable column, near-zero regret | Trivially |
| (c) Provisioning mechanism at link/consent time | **No** — depends entirely on `external-auth-model` (shared Supabase project vs linking vs OAuth 2.1) | N/A yet |

The research itself admits medium confidence on (c) in its own §4, yet the topic-level
recommendation reads as uniformly high. The decision gate should lock (a) and (b) now and record
(c) as *conditional on the auth topic*, with only the invariant pinned (explicit idempotent
provisioning, no silent null→free defaults inside `submitScorecard` — that part is sound and
consistent with the project's no-silent-defaults precedent).

## 3. What would change the answer

- **The free-tier shape itself.** "Is lifetime-25 still the right shape once rounds arrive
  automatically?" is buried as open question #2, but it is the single biggest answer-flipper: a
  weekly golfer syncing from the fitness app exhausts the free tier in ~6 months with the upgrade
  remedy in a different product. If the owner reshapes the limit product-wide (e.g. per-year),
  Option 1's main con dissolves and the warning-header design changes. This is an **owner product
  decision, not a research question** — escalate it explicitly at the gate rather than leaving it
  in a list. Note the research is right that changing the limit *only* for API rounds is Option 2
  in disguise; the owner question is about the product-wide shape.
- **supabase/auth#2408 resolving.** Would make hosted consent viable day-one and move the
  provisioning hook.
- **A real third-party consumer appearing** sooner than expected — pulls the deferred
  `api_clients` registry forward. Correctly deferred today.

## 4. Routing and sequencing

1. The **RLS insert side-door** finding (any bearer token can insert rounds via PostgREST,
   bypassing plan gating) is a genuine catch but belongs to `api-ingress-and-abuse`. Route it
   there explicitly at synthesis so it gets an owner and doesn't die as a footnote in a billing
   doc.
2. **Decision order:** external-auth-model (at minimum: same Supabase project or not) → then
   provisioning mechanics here. Metering (a) and attribution (b) have no upstream dependency and
   can be committed immediately — do not let them wait on the auth topic.
3. The race-rollback question (advisory lock vs post-hoc deletes when the pipeline is extracted)
   is an implementation-time question for the extraction work, not a gate blocker. Correctly
   parked.

## 5. Must-address before locking

1. Split the confidence: high on metering + attribution, conditional on provisioning (auth-topic
   dependency).
2. Put the free-tier-shape question in front of the owner as a named decision at the gate.
3. Re-verify supabase/auth#2408 status (citation is March 2026) before the auth topic consumes it.
4. Explicitly route the RLS side-door to `api-ingress-and-abuse` with an owner and a
   decide-by point (before tokens leave first-party hands).
