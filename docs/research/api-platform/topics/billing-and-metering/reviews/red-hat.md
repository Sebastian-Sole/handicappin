# Red Hat review — billing-and-metering

Perspective: gut feeling, founder/engineer intuition. Verdict: **mixed** — the metering
direction smells right, but two things smell wrong enough that I'd stop the presses on them.

## What feels right

- **"Rounds count against the user's account, full stop" is the boringly correct answer.**
  Zero changes to the metering math, no second billing class of rounds, no quota subsystem.
  When the recommended option is also the one that requires touching nothing, that's usually
  the real answer, not laziness. Option 2 (exempt API rounds) instantly smells like the classic
  founder mistake: quietly giving the paid feature away through the door you just built because
  you're excited someone's walking through it.
- **Explicit provisioning at link time, not silent defaults in submitScorecard.** Good
  instinct. Silent null→free inside the submission path is the kind of "helpful" hack that
  poisons your funnel data and that you find two years later while debugging why activation
  numbers never made sense.
- **`submitted_via` now, registry later.** Strong agree. A nullable text column costs nothing
  today and is unrecoverable data if you skip it — you can never backfill who wrote a round
  after the fact. This is the cheapest insurance in the whole plan.

## What smells wrong

### 1. The RLS side door is filed as a "follow-up" and my gut says that's backwards

Any bearer token can already `POST /rest/v1/round` and bypass the entire plan gate, and the
handicap trigger will happily recalculate. The whole billing discussion above it — 25-round
limits, race re-checks, error contracts — is a security theater discussion while the stage
door is propped open. The moment a second app holds tokens (even a first-party one, because
its tokens live on user devices and *will* be extracted), someone curious with mitmproxy finds
this in an afternoon. This is not a follow-up; it's a precondition for handing tokens to
anything that isn't the handicappin app itself. Gut says: the fact that it's listed last is
exactly how these things ship open.

### 2. The lifetime-25 wall inside someone else's app is a product landmine, and the RFC 9457 dressing doesn't defuse it

The recommendation spends a lot of craft on making the wall *machine-readable* (problem+json,
`upgrade_url`, remaining-quota headers) and very little on asking whether the wall makes sense
in this shape once rounds arrive automatically. A weekly golfer using the fitness app hits a
hard stop after ~6 months in a product where they never made a plan decision — "your golf
rounds stopped saving because of a limit in an app you may have never opened" is a
support-ticket generator and a one-star-review generator no matter how well-formed the error
body is. The open question ("is lifetime-25 the right shape?") is the actual product decision
here, and it's been punted to the appendix. Polishing the error contract instead has the smell
of engineers solving the solvable problem instead of the real one. I'm not saying change the
limit — I'm saying decide *on purpose* before the integration ships, not after the first angry
user.

### 3. Mild whiff of platform cosplay

RFC 9457 bodies, quota headers, `api:<client_id>` attribution format — for an API with exactly
one consumer, owned by the same person, where no `api_clients` table exists to mint a
`client_id` from. What string actually goes in that column on day one? If the honest answer is
a hardcoded `'api:fitness'`, fine — write that down and stop pretending there's a client
registry. The error-contract work is cheap and directionally right, so this is a smell, not an
objection; just don't let "future third-party platform" aesthetics add weeks to a two-app
integration. Related gut check: the prod Cloudflare challenge already bricks every
non-browser client — all of this metering elegance is moot until that dashboard fix lands, and
it's mentioned nowhere in this topic's plan.

### 4. One quiet worry about the provisioning step

"Disclosed on the link screen" — nobody reads link screens. Setting `plan_selected='free'` for
a user who tapped "connect" in a fitness app is honest *enough*, but it also means handicappin
acquires "users" who never chose it. That's fine for billing; just make sure the funnel
analytics tag these activations (the `submitted_via`/PLAN_SELECTED-event plumbing should carry
an origin) so future-you doesn't celebrate a signup spike that's actually plumbing.

## Bottom line

Agree with the mechanism (Option 1), distrust the sequencing. Close the RLS side door and
decide the free-tier-shape question deliberately before shipping; treat the error-contract
polish as the cheap part it is, not the deliverable.
