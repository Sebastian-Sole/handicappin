# Yellow Hat Review — billing-and-metering (Option 1)

Perspective: benefits and value. Verdict: **agree**, enthusiastically. This is one of the rare
recommendations where the cheapest option is also the strategically strongest one.

## Why the recommendation works

### 1. The hardest billing engineering is already done — and API rounds inherit it for free

The free tier is metered by counting round rows (verified: plan gate and limit check at
`apps/web/server/api/routers/round.ts:331-350`, count-based access check in access-control).
That means the API surface launches with **zero new metering code**: no usage-counter table, no
reconciliation job, no double-entry risk between "web rounds" and "API rounds". Even the nasty
part — the post-transaction race rollback — already covers API submissions because it, too, is a
pure row count. Most API platforms spend their first quarter building metering; this one gets
correctness on day one by doing nothing. That is the strongest possible argument for Option 1:
the billing invariant ("a round is a round") is enforced by the data model itself, not by
discipline.

### 2. Provisioning-at-link is one investment with three payoffs

The explicit idempotent provisioning step (create profile if missing + `plan_selected='free'` +
billing_version bump + PLAN_SELECTED event) is not just a bug fix for the fitness-app gap:

- It closes the opaque-FORBIDDEN onboarding hole for API consumers.
- It **supplies the native app's missing free-plan path** — today a mocked notice. A known
  product debt gets paid off as a side effect.
- It keeps funnel analytics honest: PLAN_SELECTED fires at a real consent moment, so
  API-originated activations show up as a distinct, measurable acquisition channel instead of
  silently polluting the null→free transition inside submitScorecard.

Rejecting the silent default is the right call for value reasons, not just hygiene: the
disclosed link-screen activation is the first touchpoint of a future partner-consent UX, and
building it now means the OAuth-consent flow (whenever Supabase's OAuth 2.1 server matures) has
a home to slot into.

### 3. `submitted_via` is an asymmetric bet — trivially cheap now, unpurchasable later

One nullable text column plus one analytics property. The cost is a migration and a couple of
insert-site edits. What it buys, optionally, later:

- Per-app pricing (Strava's June-2026 developer fee shows the endgame is real).
- A per-app kill switch when a misbehaving consumer floods garbage rounds.
- Abuse forensics — today web and native rounds are literally indistinguishable server-side,
  which means *any* future incident investigation starts blind.
- User-facing provenance ("via FitnessApp"), Strava-style, which is itself a viral surface —
  every attributed round is an ad for the platform inside the user's own data.

The reverse is not true: attribution cannot be backfilled once unattributed rounds exist. This
is textbook option-value purchasing, and deferring the api_clients registry keeps the cost at
exactly one column.

### 4. The 25-round wall inside the fitness app is a conversion moment, not (only) a failure mode

Counting API rounds against the lifetime 25 doesn't just prevent the free-product leak — it
**turns the fitness app into an upgrade-acquisition channel**. A weekly golfer syncing rounds
automatically hits the wall in ~6 months having experienced continuous, zero-effort value; that
is the best-primed upgrade prospect the product will ever see. The machine-readable contract
(plan_required / round_limit_reached + upgrade_url per RFC 9457, remaining-quota headers reusing
the existing 10/5 thresholds) is what converts that moment from "opaque error in someone else's
app" into a deep-linked upsell with advance warning. The error contract is also reusable
platform infrastructure: every future endpoint and consumer gets the same vocabulary for free.

### 5. Strava-alignment now means no billing migration later

Adopting "content counts against the account's rules; traffic is metered per app" — the model
the direct analogue converged on over a decade — means that when a genuine third-party consumer
arrives, the platform adds rate limits and a registry *on top of* the existing model instead of
migrating off a bespoke one. Option 2 (exempting API rounds) would have created two billing
classes of rounds inside one handicap record — a distinction that would have to be unwound,
painfully, the moment real pricing arrives. Option 1's second-order benefit is that it makes
future decisions cheaper.

### 6. The extraction dividend

The recommendation forces the observation that the rollback "must travel with the pipeline when
it's extracted from the router." That framing quietly ensures the ~700-line submitScorecard
extraction (needed anyway for the REST surface) carries its billing invariants with it — the
API project pays down the router-monolith debt rather than adding to it.

## Conditions for the value to actually materialize (must-address)

1. **The upgrade_url must genuinely work from inside the fitness app.** The conversion-moment
   benefit (point 4) collapses if the deep link lands on the Cloudflare "Security Checkpoint"
   challenge or a login wall in a browser with no session. The bypass-rule fix and the
   authenticated upgrade path need to be verified end-to-end before the first consumer ships,
   or the wall produces churn in *both* products instead of conversions.
2. **Close (or explicitly accept) the RLS insert side door before tokens leave first-party
   hands.** Every benefit above — funnel preservation, attribution, metering integrity — is
   voided by a path that inserts rounds via PostgREST with no plan gate and no `submitted_via`.
3. **The provisioning step must ship WITH the first integration, keyed to whatever the
   auth-topic decides.** It is the load-bearing piece: without it, the very first fitness-app
   user gets the opaque FORBIDDEN and the whole channel is dead on arrival.

## On the rejected options

Both rejections are value-correct. Option 2 gives away the paid feature and misreads Strava.
Option 3 monetizes an audience of one — the developer himself — while destroying the only
integration that exists. Option 1 is not a compromise between them; it is the option that keeps
both future doors (per-app pricing, per-app quotas) open at minimum present cost.
