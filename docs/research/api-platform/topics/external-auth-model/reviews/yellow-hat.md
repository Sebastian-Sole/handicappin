# Yellow Hat review — external-auth-model

**Perspective:** benefits and value. **Verdict: agree** with Option B (Supabase OAuth 2.1 server + `client_id` allowlist).

## Why this recommendation works

### 1. It converts existing infrastructure into a platform for free

The single best fact in this research: the Bearer path in `apps/web/server/api/trpc.ts` was built for the native app, and Option B makes it a *platform surface with zero code changes*. `getUser()` validation, request-scoped anon client, RLS scoping — all of it is already battle-tested in production by the native app. Option B doesn't add an auth system; it adds *issuance* to an auth system that already works. That is the highest-leverage kind of change: the marginal cost of the platform-shaped option collapses to ~2-4 days because the expensive part (correct per-user authorization at the database layer) was paid for months ago.

### 2. The asymmetry between B and A is enormous relative to the price difference

For days — not weeks — of extra work over Option A, B buys the entire third-party table-stakes bundle in one purchase:

- **Consent moment** — the "Connect handicappin" screen is the exact UX every comparable platform (Strava, Whoop) trained users to expect. It also becomes marketing surface: it's where users *see* that handicappin is a platform.
- **Refresh rotation + revocation** — `revokeGrant(clientId)` gives a real "disconnect this app" story from day one. That's a settings-page feature web/native can ship almost immediately, and it's the security story you tell when the first external developer asks.
- **Per-app identity (`client_id`)** — the unlock that keeps giving: per-app rate-limit keys (topic 3), per-app round attribution ("logged via FitApp" badges, topic 6), per-app analytics in PostHog, client-conditional RLS. None of these exist under A, and every one of them is a claim-read away under B.

A's "ships today" advantage evaporates on second-order inspection: the moment you want attribution or revocation you're migrating every user through a re-auth. B's extra days are insurance with a guaranteed payout.

### 3. Best realistic outcome: the platform path becomes additive, not a rebuild

Because B's shape already matches Strava/Whoop (auth-code+PKCE, short-lived access + rotating refresh, consent, revocation), the path from "same-developer v1" to "real third-party API" is a sequence of *additions*: swap the interim allowlist for Supabase Phase 2 scopes when they ship, add an app-review gate, publish docs. No architectural do-over, no user migration, no token-format break. The fitness app itself becomes the reference integration — living documentation and a permanent canary for the external contract. That's how Strava's own single-player mode works, and it's the cheapest possible way to de-risk a future developer program: dogfood the exact flow externals will use.

### 4. The interim scoping story is honest and cheap

The research doesn't oversell beta scopes — it correctly says they don't exist and proposes a ~50-line `client_id` allowlist plus optional RLS backstop. This is a genuinely good deal: the allowlist is the *same conceptual object* as a scope registry (client → permitted operations), so when Phase 2 lands it's a translation, not a rewrite. And the RLS backstop is elegant precisely because first-party tokens carry no `client_id` — web/native are untouched by construction, no regression surface.

### 5. Downside is capped, upside is not

The 1-day spike design is the right shape: the load-bearing assumption (`getUser()` accepts OAuth tokens) is verified before any real investment, and if the beta blocks, Option A sits behind the *identical* Bearer path — the fitness app swaps an OAuth library for supabase-js sign-in and nothing server-side changes. Worst case: 1 lost day. Best case: a third-party-ready auth surface for days of work and $0 during beta. That risk profile is about as good as infrastructure bets get.

### 6. Second-order benefits worth naming

- **Free during beta on all plans** — the evaluation window costs nothing, and being an early production user of Supabase's OAuth server likely means responsive support while they chase GA case studies.
- **Consent page doubles as product surface** — the eventual "Authorized apps" settings section is a trust feature users of a handicap product (regulated-adjacent, official-handicap ambitions) will value.
- **Vendor alignment** — B deepens the Supabase investment instead of fragmenting it (C's parallel auth) or freezing it (A's dead end). When Supabase ships Phase 2 scopes, handicappin inherits them for free — the vendor's roadmap does future work for you.
- **Strategic timing** — Garmin has *closed* its program to new developers; the fitness-integration space has room for platforms that are easy to integrate with. Having the OAuth rails already laid when that opportunity matures is optionality bought at near-zero cost.

## What must still be true (conditions on the upside)

1. The spike must pass — everything above rests on `auth.getUser()` accepting OAuth-issued tokens and `client_id` surviving into `auth.jwt()`. It's cheap; run it first.
2. The Cloudflare/Vercel challenge bypass (topic 3) must land — otherwise no benefit is reachable at all.
3. Post-beta pricing is unknown — the value case assumes it stays in normal Supabase pricing territory; a punitive per-token price would reopen the question (unlikely, but the fallback to A caps this too).
4. Do not onboard an external third party before real scopes (Supabase Phase 2 or a promoted per-client registry) — the research says this and it should be a hard gate, because the platform upside depends on never having handed an external a full-surface token.

## Bottom line

Option B is the rare choice that is simultaneously the fast option and the strategic option. The recommendation correctly identifies that the expensive platform work is already done (Bearer + RLS), prices the remaining gap honestly (days), and structures the risk so the beta dependency costs at most one spike day. Agree, with enthusiasm.
