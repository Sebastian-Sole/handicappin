# Pre-mortem review — external-auth-model

**Perspective:** It is January 2027. The fitness-app integration shipped on the Option B recommendation and failed or badly underdelivered. This is the story of how, traced back to weaknesses in the recommendation as written.

**Verdict: mixed** — Option B is the right shape, but the recommendation's "high confidence, 2–4 days, zero trpc.ts changes" framing hid the four places the effort actually died.

---

## The failure narrative

### August 2026 — the spike passed, and that was the problem

The 1-day spike did exactly what the recommendation asked: `auth.getUser()` accepted an OAuth-issued token in staging, RLS scoped correctly, `revokeGrant` worked, `client_id` was present. Green across the board. Confidence "high" got locked in.

But the spike tested **token validation on the server**, not the **flow on the phone**. The recommendation scoped the spike to the four server-side checks and treated the client side as "any standard OAuth library works." The research file itself recorded the warning sign and then walked past it: custom URI schemes for mobile deeplinks were broken until auth v2.186.0 (§2), the consent flow is bespoke UI, and supabase-js does not wrap the client side. Nobody ran auth-code+PKCE end-to-end from an actual mobile app through a deeplink redirect back into the fitness app before committing.

### September–October 2026 — "2–4 days" became six weeks

Three cost centers the estimate never priced:

1. **Mobile OAuth is not web OAuth.** The fitness app is a phone app. Auth-code+PKCE through an in-app browser, deeplink redirect capture, secure token storage, and — the killer — **refresh-token rotation on a mobile network**. Rotation + concurrent refresh attempts (app foregrounds, two requests race to refresh) + Supabase's reuse-detection = whole grant families invalidated. Users got silently disconnected every few days and blamed the fitness app. This is a well-known class of bug and the recommendation's only nod to the client side was "libraries abound."

2. **The consent page dragged in the parity machine.** Open question #6 ("does the consent page need a native twin?") was left open at decision time. It surfaced as a pre-commit failure: `pnpm parity:routes` blocked the consent route until someone either ported it to `apps/native` or argued it into `INTENTIONAL.webOnly`. A one-line open question became a design debate mid-build.

3. **Beta churn landed mid-flight.** Supabase shipped another spec-compliance fix (they'd already changed `/oauth/token` semantics once, May 2026) and announced GA pricing in Q4. The recommendation said "free during beta" and "low-regret, fallback to A" — but by the time pricing landed, the consent page, the allowlist, and the fitness app's OAuth client were built. Falling back to A now meant throwing away shipped work AND forcing users through re-auth — the exact cost A was criticized for. "Low-regret" was only true *before* building, and nobody wrote down the tripwire for when to pull the ripcord.

### November 2026 — the flow worked and nobody completed it

The quiet killer. Open question #4 — do fitness users share handicappin identity or connect via consent? — was flagged and deferred as a "product decision." Option B **presumes a handicappin account exists to consent with**. The fitness app's actual users mostly didn't have one. They hit "Connect handicappin," landed in a webview showing a *login page for an app they'd never used*, and bounced. Sign-up-inside-the-OAuth-flow (account provisioning mid-consent, email verification inside a webview, then resuming the authorization) was never designed because it was filed under "product decision," not "engineering prerequisite." Activation on the marquee feature: single digits. The auth model was technically flawless and commercially dead.

### Throughout — the two "cheap mitigations" decayed as predicted

- The RLS backstop was labeled **"optionally"** in the recommendation, so under schedule pressure it was skipped. When a fitness-app build accidentally logged bearer tokens to a third-party crash reporter in October, the leaked tokens carried the user's **full RLS surface — billing and profile included**. The app-layer allowlist didn't help: it lives in the tRPC layer, and the tokens work against PostgREST/Supabase directly with just the public anon key. The allowlist was never a security boundary, only a convention — the recommendation blurred that distinction.
- The Cloudflare/Vercel challenge bypass was a parenthetical ("topic 3"). The bypass rule got configured for the spike, then a Cloudflare setting change during an unrelated bot-mitigation tweak re-enabled challenges on the API path in December. No contract test existed asserting "cookie-less request from a non-browser UA reaches the origin," so it shipped broken for nine days before anyone correlated the fitness app's `Unexpected token '<'` errors.

---

## Preconditions to avoid this future

1. **Widen the spike to the full mobile round-trip, and add a standing canary.** The go/no-go spike must include: auth-code+PKCE from a real device build, deeplink redirect capture, refresh-token rotation under a forced concurrent-refresh race, and a non-browser request reaching production origin past Cloudflare. Keep the last one as a permanent scheduled check, not a one-time verification.

2. **Resolve the account-provisioning question (open Q4) BEFORE build, as an engineering prerequisite, not a deferred product decision.** Design the "fitness user with no handicappin account" path — sign-up inside the authorization flow, resuming the grant after verification — or accept in writing that v1 only serves the overlap audience. B without this is a consent screen nobody can consent on.

3. **Promote the RLS backstop from "optional" to mandatory, and write the beta exit tripwire down.** The client_id-deny policies on billing/profile tables are the only mitigation that holds when tokens bypass the tRPC layer (they can — anon key + PostgREST is enough); the ~50-line allowlist is routing hygiene, not a boundary. And define now: "if GA pricing exceeds X, or a breaking beta change costs more than Y days, we cut to Option A by date Z" — otherwise sunk cost makes the 'low-regret fallback' fictional.

---

*Reviewed 2026-07-20 against `docs/research/api-platform/topics/external-auth-model/research.md`.*
