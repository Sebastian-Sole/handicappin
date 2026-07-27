# Green Hat Review — external-auth-model

Perspective: creativity and alternatives. What wasn't considered, what's simpler, and whether the problem can be reframed away.

Verdict: **agree** with Option B — but the option space was framed narrowly as "which token issuer", and three reframings deserve to be on the record. One of them materially improves the recommendation's own fallback story.

## 1. The A→B "dead end" is likely overstated — which makes B even lower-regret

The research's biggest con for Option A is "later migration forces every user to re-auth." But A and B use the **same Supabase project and the same `auth.users` rows**. Upgrading from A to B is not an identity migration — it's adding a consent/OAuth flow in front of the same accounts. Users would OAuth into an account they already have; nothing is lost, no data re-keyed. That means:

- The recommended fallback ("if the beta blocks, drop to A") is genuinely cheap in *both* directions — you can also *start* with A this week and graduate to B when the spike or GA lands, without a rebuild.
- A staged path — **A now with an explicit in-app "Connect handicappin" account-linking screen** (the consent UI you'd build for B anyway), then swap the token acquisition to the OAuth flow later — was not considered as its own option. It ships in ~1 day and reuses ~all of its UI when B arrives.

This doesn't change the verdict (B is still right if the spike passes), but the decision should not be made on the belief that A is a one-way door. It isn't, within a shared project.

## 2. Reframe: the endpoint can be the scope

The interim scoping proposal (client_id allowlist inside tRPC + RLS backstop) treats scoping as a token problem. The simpler inversion: **don't let external tokens reach tRPC at all**. Mount the tiny external surface (topic: rest-surface) — submit-scorecard, course-search, read-own-rounds — as its own `/api/v1` handlers, and make *that mount point* the only place Bearer-with-`client_id` tokens are accepted; tRPC's context rejects any token carrying `client_id`. Then:

- The "scope" is structural, not a 50-line allowlist that must be maintained as routers grow. New tRPC procedures are external-inaccessible **by default** instead of by remembering to update a list.
- This composes with, not against, the recommendation — it's the same ~50 lines, moved to where they fail closed.

## 3. Reframe: does v1 need an API call at all?

For same-developer v1 there is a zero-auth-infrastructure option nobody named: **app-to-app handoff** (universal link / Android App Link / iOS App Intent). Fitness app finishes the scorecard → deep-links into handicappin (native app or web) with the payload → handicappin, already authenticated, submits through the existing pipeline. Zero new tokens, zero Cloudflare exposure, consent is implicit in the handoff.

It fails the "saves automatically" bar (foreground app switch) and does nothing for the third-party ambition, so it's rightly not the answer — but it is the honest "ship this week" baseline the 2–4-day estimate for B should be compared against, and it's a fine degraded mode if the OAuth beta spike fails *and* Cloudflare bypass drags.

## 4. Reframe the third-party ambition: maybe you never build the platform

The prior-art table cites Terra as a comparator but misses its strategic implication: aggregators (Terra, Rook, Spike) exist precisely so activity apps don't each build partner programs. A plausible endgame is handicappin as an aggregator **destination**, where the aggregator owns third-party OAuth, scopes, app review, and webhooks. If that's a live possibility, the pressure to make v1 "third-party-shaped" drops — B's consent/revocation machinery is then a nice-to-have for the same-developer case, not a foundation. Worth a one-line product decision before investing in bespoke consent UI polish.

## 5. Smaller unconsidered lever

- The research itself notes (line 44) that the **Custom Access Token Hook can inject per-`client_id` claims today**. That's the cheapest place to stamp e.g. `"scp": ["rounds:write"]` into OAuth-issued tokens *now*, so RLS policies and the REST surface can check a forward-compatible scope claim from day one — when Supabase Phase 2 ships real scopes, the checks don't move. The recommendation should fold this in rather than keying everything off raw `client_id` presence.

## Must-address before locking

1. Verify the A→B upgrade path in the spike: confirm OAuth-issued tokens for an existing `auth.users` account link cleanly (no duplicate identities), so the fallback/staged option is real.
2. Decide the aggregator question (build platform vs. become destination) at the strategy level — it changes how much of B's third-party shaping is load-bearing.
3. Prefer the fail-closed placement: external tokens accepted only at the `/api/v1` mount, rejected in tRPC context — rather than an allowlist inside tRPC.
