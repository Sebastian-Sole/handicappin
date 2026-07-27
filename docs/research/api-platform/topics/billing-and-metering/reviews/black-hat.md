# Black Hat Review — billing-and-metering

Perspective: caution and risk. Verdict: **mixed**.

The core metering choice (API rounds count against the same lifetime-25 pool) is the
least-bad option and I won't fight it. But the recommendation packages that sound choice
with several under-examined risks, and it labels as "follow-up" the one thing that makes
the whole billing decision fictional.

## 1. The RLS side door makes the entire decision theater until it's closed

The research itself found that any bearer token can insert rounds via PostgREST directly,
bypassing plan gating, the 25-round count enforcement point, and any future `submitted_via`
stamping — and then relegates it to a "follow-up security decision." That ordering is
backwards. The moment tokens live inside a second app on user devices (first-party or
not), the enforcement story is only as strong as RLS, and RLS currently says "insert
freely." A mildly curious user with mitmproxy gets unlimited round tracking — the paid
feature — plus rounds with no attribution and no billing_version audit trail, and the
handicap-queue trigger happily recalculates off them. This is a **precondition** of
shipping any token-bearing consumer, not a follow-up. If it can't be closed at the RLS
layer without breaking the apps, that constraint should reshape the recommendation (e.g.
inserts only via a security-definer path), and we should know that *before* locking
Option 1.

## 2. The race-rollback is a liability that API traffic will actually trigger

round.ts:949-992 is post-hoc, non-transactional cleanup: count re-check via Supabase REST,
then manual deletes of submissions/round/tees/course. Today it's guarding against a human
double-tapping a submit button — nearly never fires. An API consumer changes the traffic
shape entirely: the obvious fitness-app behavior is **batch backfill** (user links
account, app syncs 30 historical rounds concurrently). Then:

- Which 5 of 30 get deleted is a race — nondeterministic, and not necessarily the 5 the
  user cares least about. Rounds visibly appear then vanish.
- The deletes run *after* the transaction committed and after downstream effects
  (handicap-queue trigger, admin notifications for pending submissions) may have fired.
  If any delete fails midway (the error path only logs on the count re-check, and nothing
  wraps the delete sequence), you get orphaned tees/courses or a deleted round whose
  handicap contribution already landed — a corrupted handicap, which is the product's one
  promise.
- The recommendation says the rollback "must just travel with the pipeline when it's
  extracted." Porting a known-fragile mechanism into a higher-concurrency context is how
  it graduates from theoretical to weekly incident. The open question about replacing it
  with an in-transaction advisory lock should be answered *as part of* this decision, not
  deferred — extraction time is exactly when it's cheapest to fix.

## 3. `api:<client_id>` attribution is self-reported fiction until a registry exists

The recommendation defers the api_clients registry but adds `submitted_via` "for abuse
forensics." With no registry and no key issuance, the client_id portion is whatever the
caller writes — a forensics column an abuser fills in himself. It's fine as *analytics*
for first-party apps; it must not be sold internally as a security/forensics capability,
or someone will later build a per-app kill switch on a spoofable string. Also: nullable-
as-legacy means the column is permanently three-valued (web/native/api/null-meaning-old),
and every future query over it carries that wart. Cheap column, yes — but decide the
backfill/null semantics now or eat ambiguity forever.

## 4. Provision-at-link creates billing state for users who never chose the product

The provisioning step writes a profile, sets `plan_selected='free'`, bumps
billing_version, and emits PLAN_SELECTED — for a user whose actual intent was "let my
fitness app save golf scores." Risks:

- **The trap plays out 6 months later.** A weekly golfer burns the lifetime-25 silently
  in the background, then sync starts failing with FORBIDDEN inside a different product.
  Best case the fitness app renders the RFC 9457 body beautifully; realistic case it
  shows "sync failed," the user's handicap silently diverges from reality, and the first
  support ticket lands with no idea handicappin is involved. The warning headers only
  work if the *other* codebase implements them — the recommendation's mitigation lives
  entirely in software this decision doesn't control. At minimum, require the header/
  error handling contractually in the link flow, and consider server-side email at the
  10/5 thresholds so the warning path doesn't depend on the consumer.
- **Funnel pollution is guaranteed, not avoided.** The recommendation rejects silent
  defaults partly to protect funnel analytics, then emits PLAN_SELECTED from a
  machine-mediated consent screen most users click through. Unless these activations are
  segmentable (they are — via submitted_via/an event property — but only if someone
  remembers), onboarding conversion metrics quietly go bad.
- **Consent/GDPR surface.** Creating an account-with-billing-state in product B from
  product A's flow, disclosed "on the link screen," is the kind of thing that reads fine
  in a design doc and poorly in a data-protection complaint. The EARLY100 promo question
  being open confirms the provisioning semantics aren't actually settled.

## 5. "High confidence" rests on an undecided foundation

The provisioning step — the load-bearing fix for the onboarding gap — "must attach to
whatever consent/link flow the auth-topic research chooses," which is undecided, and the
Supabase OAuth 2.1 consent-path gap was still open as of March 2026. And none of the
machine-readable error contract matters while Cloudflare challenge mode 429s every
cookie-less request in prod: the first observable failure mode of this integration will
be an HTML challenge page, not a tidy RFC 9457 body. Confidence in the *metering* choice
can be high; confidence in the *package* should not be.

## Worst realistic outcome

Fitness app ships; backfill sync triggers rollback races that delete rounds after
handicap recalculation; a handful of users' handicaps are wrong; meanwhile a Reddit post
explains the PostgREST insert that skips the limit entirely; and six months in, the
free-tier wall surfaces as opaque sync failures in an app that never mentions
handicappin. Every ingredient of that scenario is already documented in this research —
none of it requires bad luck, only shipping the recommendation in its current ordering.

## Bottom line

Accept the metering model (Option 1's core). Do not lock the decision until: the RLS
insert side door is closed or consciously accepted **before** tokens leave first-party
hands (as a gate, not a follow-up); the race-rollback is replaced or hardened as part of
pipeline extraction (batch-sync concurrency makes it live); `submitted_via` is scoped as
analytics-not-forensics with null semantics decided; and the provisioning step's consent,
promo, and analytics-segmentation semantics are specified rather than hand-waved at the
link screen.
