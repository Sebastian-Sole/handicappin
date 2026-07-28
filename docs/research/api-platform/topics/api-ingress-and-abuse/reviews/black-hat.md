# Black Hat review — api-ingress-and-abuse

**Perspective:** caution and risk. Where does the Option B recommendation break, and what is the worst realistic outcome?
**Verdict:** MIXED — the destination (grey-clouded `api.handicappin.com`, toggle off, ordered host-keyed rules) is defensible, but the sequencing is reckless, the abuse-layer replacement is thinner than it looks, and the plan bets "high confidence" on two facts nobody has checked (dashboard state, Vercel plan tier).

---

## 1. Step 1 turns off the shield before anyone knows why it was raised

The recommendation's very first action is "today: turn the Attack Mode toggle off" — while open question #5 admits nobody knows **whether an actual attack motivated the challenge**. If the challenge was a response to a real event (or to Vercel's own heuristics tripping), toggling it off before diagnosing re-exposes the site with nothing behind it except automatic DDoS mitigation — which the research *itself* establishes is degraded on the still-orange-clouded main host, because all traffic arrives from a handful of Cloudflare egress IPs (§1.4). So the fallback layer cited to justify removing the challenge is precisely the layer the research says is blinded on `handicappin.com`. The "optional" replacement challenge rule must not be optional in step 1; and the dashboard check (open question #1) and plan check (#2) must happen **before** the toggle-off, not after. Recommending an irreversible-in-effect posture change ahead of a 5-minute diagnostic is backwards sequencing.

## 2. The challenge was also a free denial-of-wallet shield; nothing in the plan replaces that

Today, the challenge blocks junk **pre-function at zero cost**. After Option B:

- The only pre-function backstop on the API host is **one fixed-window, per-region, IP+JA4 rate-limit rule**. Per-region counters mean a modestly distributed botnet multiplies the nominal limit by region count; IP keys are rotated trivially; JA4 is spoofable by anyone who controls their TLS stack.
- Everything that leaks past it **invokes a serverless function and bills the owner**. "Auth 401s junk cheaply" is wrong at the margin: `getUserFromBearerToken` performs a Supabase auth verification per request, Upstash limiters cost a Redis round-trip per request and are **fail-open by design** (`lib/rate-limit.ts`) — an attacker who can degrade Upstash disables the app-layer limits entirely. On Pro, WAF rate-limiting itself is usage-priced.
- Worst realistic outcome: an unauthenticated flood at `api.handicappin.com` (now grey-clouded, real IPs, no challenge, no Cloudflare L7) produces a surprise Vercel bill and/or hits function concurrency shared with the paying web app (see §3). The plan needs **Vercel spend limits/alerts and a 401-rate alarm** as first-class steps, not implicit trust in four leaky layers.

## 3. "Isolation" in Option B is edge-only — blast radius is still one project

Option B is sold as "decouples API availability from the site's edge posture." True at the edge, false everywhere else: same Vercel project means **shared function concurrency, shared usage quotas, shared billing, shared deploys, shared env**. An API-host flood or a buggy fitness-app client in a retry loop degrades the scorecard experience for every web and native user. The research's own finding for the stack topic ("edge ingress alone does not justify a separate deployment") is fine, but the review record should be honest that Option B buys hostname and firewall scoping, **not** failure isolation — that argument gets stronger, not weaker, the moment real third parties integrate.

## 4. Security-critical config that is unversioned, untested, and single-owner

Bypass rules cannot live in `vercel.json`. So the entire ingress posture becomes **dashboard state**: no review, no diff, no CI, no drift detection, restorable only from a doc in `docs/` that will be stale by the second edit. Concrete failure modes:

- **Rule-ordering mistakes fail silently.** Bypass placed above the rate-limit rule = API host has *no* edge limits at all, and nothing will ever alert on it. Bypass scoped one path too wide = challenge-exempting the whole site.
- **The Attack-Mode footgun is mitigated only by a runbook sentence.** A future incident at 2am, a well-meaning panic-click, and the API + every shipped native binary goes dark — silently, since the failure is 429 HTML that surfaces as client-side parse errors, not server errors in Sentry. A runbook is not a control. The minimum real control is a **synthetic probe** (cron `curl -I` against `/api/trpc` and `/api/v1/health` asserting no `x-vercel-mitigated` header) paging on failure. That belongs in the recommendation, not the appendix.
- **Vendor-mutable semantics.** The load-bearing fact — Attack Mode overrides bypass; bypass skips subsequent rules — rests partly on a 2024 community post. Vercel can change firewall evaluation semantics at any time, config is invisible to CI, and the first signal would again be prod users' HTML-parse errors.

## 5. The main host's bypass rules become permanent legacy the plan doesn't acknowledge

Shipped native binaries pin `EXPO_PUBLIC_API_BASE_URL=https://handicappin.com`. Until a **forced-upgrade** mechanism exists, the `/api/trpc` bypass rules on the main (orange-clouded, IP-degraded) host are load-bearing indefinitely — every risk in §2/§4 applies to that host too, forever, regardless of how clean `api.handicappin.com` is. "Migrate native when convenient" (open question #7) understates this: the old-binary tail is the constraint, not the next EAS build.

## 6. The host guard becomes a security boundary

Serving the same Next.js app on two hostnames means `proxy.ts` Host-header logic now decides whether admin/site routes are reachable via the API host and vice versa. Host headers are attacker-controlled input; middleware has been the site of real Next.js auth bypasses (CVE-2025-29927 class). The "~1 day incl. rule testing" estimate does not price in negative testing of the host guard (wrong Host, absent Host, Host with port, HTTP/1.0), CORS posture on the api host, and cache-key implications. Small work, but it must be treated as security-relevant code with tests, not routing sugar.

## 7. Smaller traps worth logging

- **Hobby-plan cliff:** 3 custom rules + 1 rate-limit rule is *exactly* the proposed rule set with zero headroom for webhook bypasses or a second API path. If the project is on Hobby, the design as written may not fit — verify before committing (open question #2, again *before* step 1).
- **Billing data may already be corrupt:** if Stripe/RevenueCat deliveries were dropped during the challenge months, the plan-gating the API layer relies on (`submitScorecard` billing checks) is built on divergent state. The webhook-delivery audit is a precondition for trusting API-side gating, not an open question.
- **Grey-clouding leaks the Vercel origin mapping** — minor (Vercel is anycast), but if origin-hiding was the reason for orange-cloud, someone chose it once; find out who/why before undoing it (open question #3).

---

## Bottom line

Option B is the right *shape*, and the research correctly killed the naive "bypass under challenge mode" plan. But as written the recommendation (a) acts before diagnosing, (b) replaces a free pre-function shield with fail-open, per-region, billable layers and no spend guard, (c) relies on a runbook where it needs a monitor, and (d) claims isolation it doesn't deliver. Fix the sequencing and add the probe + spend controls, and it's sound.
