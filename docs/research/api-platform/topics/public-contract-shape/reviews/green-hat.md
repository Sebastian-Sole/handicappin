# Green Hat review — public-contract-shape

**Stance:** Agree with Option A as the shape, but the research framed the problem narrowly in three places where a reframe makes work disappear or shrink.

## 1. The Cloudflare "day-0 blocker" is a framing artifact — move the API off the challenged hostname instead of punching a hole in it

The research treats a Cloudflare/Vercel challenge-mode bypass rule for `/api/v1/*` as an unavoidable ops prerequisite. Reframe: the challenge only exists because the public API is planned to live on the *web app's* hostname. Serve the contract from `api.handicappin.com` — gray-clouded in Cloudflare (or DNS-only, pointed straight at Vercel as a second domain on the same project) — and the blocker never exists. Bonus properties the bypass-rule approach doesn't give you:

- No risk that a future Cloudflare config change silently re-arms the challenge on the bypassed path (the exact class of dashboard drift that caused the original tRPC outage in memory `vercel-challenge-mode-breaks-trpc`).
- A dedicated hostname is the industry-normal partner-API shape (api.stripe.com, api.ouraring.com), gives you independent rate-limit/WAF policy, and later lets you move the API off the Next.js deployment entirely without breaking a single partner URL. That last point is the real option value: `/api/v1` on the app domain welds the public contract to the web app's hosting forever.

Same Next.js route handlers, same repo — this is a DNS/domain decision, not a code decision. It should at least be evaluated head-to-head with the bypass rule.

## 2. Unconsidered option: Supabase-native surfaces (worth naming, then parking)

Nobody evaluated the backend the product already runs on:

- **Supabase Edge Functions** as the public surface: TypeScript, bearer-token + RLS native, hosted on `*.supabase.co` (or custom domain) — completely outside the Cloudflare/Vercel challenge. The extracted `submitScorecard` service could run there if it's extracted into a package rather than into `apps/web/server/services/`.
- **PostgREST RPC** (`/rest/v1/rpc/submit_scorecard`): the contract becomes a Postgres function. Zero new HTTP surface.

Verdict after consideration: park both — the 700-line pipeline is entangled with Stripe/billing and Sentry wiring that lives in the Next.js app, PostgREST would mean porting handicap math to plpgsql, and Edge Functions would fork the deployment story. But the *lesson* survives: **extract the service layer into a location-agnostic package (or at least keep it framework-import-free), not merely "out of the router"**, so the Edge Function / separate-API-deployment door stays open. The research's open question "scope of the service extraction" should absorb this constraint.

## 3. Shrink v1 to one endpoint and let the fitness app's real usage design the rest

The recommendation reflexively sizes v1 at 4–6 endpoints plus a full ops package (RFC 9457 + 9745 + 8594, hosted spec, changelog, written deprecation policy). The only *known* requirement is: fitness app posts a scorecard. Alternative sequencing that gets the same end state cheaper:

- **v1.0 = `POST /rounds` only** (plus maybe `GET /rounds/{id}` for confirmation). Ship problem+json errors and the stable code set from day one — that's cheap and hard to retrofit. Defer the deprecation-policy document, Sunset-header machinery, and hosted changelog until there is one consumer you don't control; a git-tracked OpenAPI file in the repo is a fine "hosted spec" until then.
- The read endpoints (`GET /handicap`, `GET /courses/search`) are speculative until the fitness app's UX is designed. Designing them now, without a consumer, is exactly how APIs grow shapes their first real partner doesn't want. Let the fitness app be the design probe — that's the one luxury of same-developer-both-sides that Option C overvalued and this recommendation undervalues.

## 4. Missing from the ops package entirely: idempotency

For a scorecard-submission API consumed by a mobile fitness app on flaky networks, an `Idempotency-Key` header (persisted key → response replay) is more important on day 1 than deprecation headers are in year 1 — a retried POST that double-creates a round corrupts the handicap calculation, the product's core artifact. This also pairs with the service extraction: idempotency belongs in the extracted service seam, and the research itself notes (Option B cons) that idempotency is a reason extraction is needed "for anything that isn't a tRPC call" — yet it never made the recommended package. Add it.

## 5. A bridge nobody priced: fitness app ships *today* on the native-app pattern

Option C was rejected on the type-import premise, correctly. But there's a fourth option hiding in its ruins that wasn't priced: the fitness app copies `apps/native/lib/api/client.ts` verbatim (untyped tRPC client + zod revalidation) as a *temporary* bridge — proven in production, near-zero server work — while `/v1` is built without deadline pressure, then the fitness app migrates as `/v1`'s first consumer/test harness. "Two migrations instead of one" is the stated con, but both migrations are self-inflicted same-developer costs on a tiny call surface (~1–2 calls). This decouples the fitness app's launch date from the platform work. Not necessarily the right call — but it's a real schedule option and the research never priced it.

## Verdict

**Agree** with hand-written `/api/v1` REST + path versioning + shared zod + service extraction. Must-address before locking: (a) dedicated API hostname vs bypass rule, decided explicitly; (b) idempotency in the v1 contract; (c) service extraction targeted at a location-agnostic package, not just "out of round.ts"; (d) v1 scope trimmed to demonstrated fitness-app needs, deferring the heavier deprecation machinery until a non-self consumer exists.
