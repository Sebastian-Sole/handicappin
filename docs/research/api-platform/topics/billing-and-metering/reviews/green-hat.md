# Green Hat review — billing-and-metering

Perspective: creativity and alternatives. Verdict: **agree** with the core recommendation
(meter API rounds against the same lifetime-25 count; no silent defaults; attribution column
now) — but several simpler or more generative moves were not on the options list at all.

## 1. The null-plan state could be made to not exist

Option 1 treats `plan_selected = null` as a fact of life and adds a provisioning step at
link/consent time. Greener reframe: **kill the null state at the source**. Default
`plan_selected = 'free'` when the profile row is created (in the `create-profile` edge
function, or better, a DB trigger on `auth.users` that also closes the "no profile row at
all" layer), backfill existing nulls, and turn web onboarding's free-plan step into an
upgrade prompt instead of a gate. Then:

- there is no provisioning step to attach to whatever the auth topic picks (the dependency
  in Option 1's cons list dissolves);
- native's mock free-plan button becomes unnecessary rather than fixed;
- `submitScorecard`'s "Please select a plan" branch becomes dead code you delete.

The research's own Strava citation supports this: Strava has no "account exists but never
picked a plan" state reachable via API — not because of a consent-time provisioning step,
but because **the state is unrepresentable**. If the explicit free-choice funnel event is
sacred for analytics, fire `PLAN_SELECTED(source='default')` from the trigger — but that's
a reason to instrument the default, not to keep a nullable gate three products must dodge.

## 2. Accept-and-quarantine beats reject at the limit (not considered)

All three options assume an over-limit submission must be **refused**. Fourth option:
**never refuse a round; quarantine it.** Over-limit API rounds are stored in a
`pending_locked` state — excluded from handicap calculation and round counts, invisible in
history, unlocked oldest-first on upgrade.

- The upgrade pitch inside the fitness app becomes "You have 12 rounds waiting — unlock
  them", which is a far stronger cross-product funnel than a 403 with an `upgrade_url`.
  Photo services (Google Photos over-quota) monetize exactly this way.
- The ugliest code in the current pipeline — the post-transaction race re-check that
  **manually deletes** rounds, submissions, and auto-created courses (round.ts:949-992) —
  disappears: a race no longer needs destructive rollback, the loser just lands quarantined.
  That answers open question #5 by deleting it.
- No paid-feature leak: quarantined rounds don't feed the handicap, so the free product is
  unchanged. This is Option 2's "never bricks the integration" pro without Option 2's leak.

Cost: one status column + a filter in the count/handicap queries. If it's rejected, reject
it consciously — it should have been on the table.

## 3. The "upgrade lives in another product" con has a direct dissolvent: RevenueCat

The recommendation's main residual con is that free fitness-app users hit the wall with the
remedy in a different app. But both apps are the same developer and the **RevenueCat
webhook → `applyBillingEvent` chokepoint already exists**. RevenueCat supports cross-app
entitlements within one project: sell handicappin premium **inside the fitness app's own
paywall** and the entitlement lands via the existing webhook. The deep-link-to-/upgrade
mitigation is the weak version of this; nobody proposed the strong one.

## 4. `submitted_via` is too small a column — and the missing idea is idempotency

Strava's attribution isn't just "via {app}"; it's `external_id` + `device_name` — and
`external_id` is doing **dedupe** work. The moment two first-party clients (watch, fitness
app, native) can write rounds automatically, duplicate submission of the same physical
round is a *when*, not an *if* — and nothing in the pipeline or the research addresses it.
Since a schema migration is being cut anyway, make it a `submission_meta jsonb`
(`{via, client_id, external_id, device}`) or `submitted_via` **plus**
`external_id text` with a partial unique index per user+client. An idempotency/dedupe key
is arguably more urgent than attribution: attribution serves hypothetical future pricing;
dedupe protects the handicap record — the actual product — from day one.

## 5. Reframe worth naming: the first consumer may not need the REST surface's billing story at all

The fitness app is first-party. If it authenticates against the same Supabase project and
calls tRPC exactly as the native app does (bearer-token path already works), the entire
topic collapses to "identical to native by construction" — and the REST error contract,
RFC 9457 bodies, and quota headers can wait for the first *third-party* consumer. This is
the auth topic's call, but the billing recommendation shouldn't hard-couple its ship list
(error contract, headers) to the first integration if the first integration might never
send a cookie-less REST request.

## 6. The RLS side door and the race re-check are the same problem — one mechanism closes both

The follow-up list treats "restrict the PostgREST insert policy" and "replace the manual
rollback" as separate questions. A single `BEFORE INSERT` trigger (or RLS `WITH CHECK`
calling a `security definer` count function) that enforces the free-tier count **in the
database** closes the side door, deletes the race re-check, and makes the meter
enforcement live where the rows live — one mechanism instead of three. Worth evaluating
before building the extracted pipeline around the tRPC-layer gate. (If quarantine from §2
is adopted, the trigger sets status instead of rejecting.)

## Bottom line

The recommendation's spine — count API rounds identically, no silent defaults inside
`submitScorecard`, attribution recorded now — is right and I agree with it. But before
locking: (a) accept-and-quarantine deserves a real yes/no, because it changes the error
contract being specced; (b) default-free-at-profile-creation may make the provisioning
step unnecessary; (c) the migration should carry an idempotency/external_id key, not just
`submitted_via`.
