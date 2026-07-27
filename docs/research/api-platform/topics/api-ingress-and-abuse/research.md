# API ingress: getting past the Cloudflare/Vercel challenge wall, and what replaces it

**Topic:** `api-ingress-and-abuse` (merges api-ingress-cloudflare-vercel, edge-access-and-abuse-controls, api-edge-topology)
**Researched:** 2026-07-20
**Status of the blocker:** re-confirmed live today — `curl -I https://handicappin.com/` and `https://handicappin.com/api/trpc/*` both return **HTTP 429 + `x-vercel-mitigated: challenge`** (Vercel Security Checkpoint HTML), served through Cloudflare (`server: cloudflare`, `cf-ray: …-OSL`, Vercel region `arn1`). Any cookie-less client — curl, the fitness app, the shipped native app — is blocked on every path.

---

## 1. Ground truth (verified in repo and against prod)

### 1.1 The challenge is Vercel's, Cloudflare is the proxy in front

- Response headers today (2026-07-20): `x-vercel-mitigated: challenge`, `x-vercel-challenge-token`, `server: cloudflare`, `cf-cache-status: DYNAMIC`. The mitigation is **Vercel's firewall challenge**, not a Cloudflare challenge. Cloudflare is orange-clouded (proxying) in front of Vercel.
- The challenge fires on **all paths**, including `POST /api/trpc/*` — consistent with either the project-wide **Attack Mode** toggle or a project-wide custom challenge rule (which one is on is only visible in the Vercel dashboard → Firewall; see Open Questions).
- This is not new/transient: memory note from 2026-07-16 recorded the same signature, including a real prod user's tRPC failure (`Unexpected token '<'`).

### 1.2 It already breaks first-party clients, not just future API consumers

- `apps/native/eas.json` production/preview profiles set `EXPO_PUBLIC_API_BASE_URL=https://handicappin.com` — a shipped native build performs cookie-less Bearer-token fetches and would receive the 429 challenge HTML on every call. The whole Bearer-auth path built in `apps/web/server/api/trpc.ts` (lines 27–174: `extractBearerToken` → `getUserFromBearerToken` → `createBearerTokenSupabaseClient`) is unreachable in production today.
- Browser users are also intermittently hit: challenge sessions last 1 hour; a long-lived tab (scorecard during a round) outlives the session and `fetch()` cannot re-solve a challenge.
- So this fix is required **regardless of the fitness-app integration**; the API platform work just makes it urgent and permanent.

### 1.3 What the app layer already has (the "replacement" building blocks)

- `apps/web/lib/rate-limit.ts`: Upstash `@upstash/ratelimit` sliding-window limiters (per-minute and per-hour factories), env-tunable limits, fail-open design, and `getIdentifier(request, userId)` that keys `user:{id}` for authenticated traffic and falls back to `x-real-ip` for anonymous traffic. Adding `apiV1`/per-key limiters is a ~10-line change per endpoint class.
- `proxy.ts` (Next middleware) runs on all non-static paths — a natural place for host-based routing if a dedicated API hostname is adopted.
- `apps/web/vercel.json` is minimal (install/build commands + one cron); no firewall config in-repo. Note: `vercel.json` `routes[].mitigate` supports only `challenge`/`deny` — **`bypass` is dashboard-only**, so the fix cannot be fully codified in the repo ([WAF Custom Rules docs](https://vercel.com/docs/vercel-firewall/vercel-waf/custom-rules), last_updated 2026-07-01).

### 1.4 The Cloudflare-proxy side effect on client IPs (latent bug worth knowing about)

Vercel's official position on proxies in front of Vercel ([KB: Can I use a proxy on top of my Vercel deployment?](https://vercel.com/kb/guide/can-i-use-a-proxy-on-top-of-my-vercel-deployment)):

- "We do not recommend this approach"; support may require disabling the proxy before assisting.
- The proxy's IP **replaces the actual client IP** as far as Vercel is concerned (geolocation, firewall heuristics, `x-real-ip`/`x-forwarded-for`, which Vercel overwrites for spoof-resistance). Only Enterprise "Trusted Proxy" changes this.
- Consequence 1: Vercel's DDoS heuristics see all handicappin traffic concentrated on a handful of Cloudflare egress IPs — which *aggravates* mitigation ("if we detect an anomaly in requests coming from a single source, the IP can get banned").
- Consequence 2 (in-repo): `getIdentifier()`'s `x-real-ip` fallback currently buckets **all anonymous traffic into Cloudflare edge IPs**, so per-IP Upstash limits (contact form, OAuth callback, etc.) are effectively shared buckets across all anonymous users. Same for any Vercel WAF rate-limit rule keyed by IP. Grey-clouding fixes this at the root; `cf-connecting-ip` is not app-verifiable on Vercel (can't prove the TCP peer was Cloudflare), so it is not a clean substitute.

---

## 2. Platform facts that decide the design (primary sources, July 2026)

### 2.1 Attack Mode cannot be path-bypassed — this kills the naive plan

- **Attack Mode takes precedence over ALL custom WAF rules, including `bypass`.** Vercel staff (Lee Robinson), [vercel/community discussion #7221](https://github.com/vercel/community/discussions/7221) (June 2024, still the documented behavior in 2026): "Attack Challenge Mode would take precedence over those rules… You need to *not* use Attack Challenge Mode, and instead use a custom rule that is a 'challenge' — a rule with a 'challenge' that targets all paths."
- So the option named in the decision question — "challenge-mode bypass rules scoped to `/api/v1/*`" — **does not exist as such**. The supported equivalent is: **turn the Attack Mode toggle off** and rebuild the same posture from ordered custom rules, where `bypass` *does* work (a custom bypass rule "is allowed through any custom or managed rules" — [Firewall concepts](https://vercel.com/docs/vercel-firewall/firewall-concepts), last_updated 2026-06-16).
- Corollary/footgun: if anyone re-enables the Attack Mode toggle during a future incident, it silently re-breaks the API and the native app **no matter what bypass rules exist**. Any design keeping challenge capability must encode "never use the toggle; use the challenge *rule*" as a runbook rule.
- [System Bypass Rules](https://vercel.com/docs/vercel-firewall/vercel-waf/system-bypass-rules) (last_updated 2026-06-16) are **IP/CIDR-based only** (no path/host matching), Pro: 25/project, Hobby: N/A — they exempt trusted source IPs from *system* mitigations. Not usable for "exempt `/api/v1/*`" (and bypassing Cloudflare's egress ranges would exempt ~all traffic from DDoS protection — do not do this).
- "Protection Bypass for Automation" (`x-vercel-protection-bypass` header) is a **Deployment Protection** feature (preview-URL auth), not a firewall bypass — a common confusion; it does not solve this.

### 2.2 What Vercel custom rules CAN do (all verified against docs dated 2026-06/07)

- Actions: `log`, `deny`, `challenge`, `bypass`, `redirect`, `rate_limit`; match fields include **`host`, `path`, method, header, cookie, user_agent, IP, geo, JA4/JA3 digest** ([Custom Rules](https://vercel.com/docs/vercel-firewall/vercel-waf/custom-rules), [Firewall concepts](https://vercel.com/docs/vercel-firewall/firewall-concepts)). Rules are ordered, take effect immediately without redeploy, and challenge/deny/rate-limit support **persistent actions** (time-based IP block, free of CDN usage).
- Rule evaluation: `bypass` skips **subsequent** rules → ordering for an exempted API path must be: **(1) rate-limit rule on the API host/path → (2) bypass rule for the API host/path → (3) any challenge/deny rules for the rest of the site**.
- [WAF Rate Limiting](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting) (last_updated 2026-06-16): keys = IP and JA4 on Hobby/Pro (arbitrary header keys **Enterprise only** — so per-API-key edge limits are not available on Pro); fixed window 10s–10min; **counters are per-region** (a distributed client can exceed the nominal limit); Hobby: 1 rate-limit rule + 3 custom rules total, 1M included allowed requests; Pro: 40 rate-limit rules, usage-based pricing; blocked requests don't hit functions.
- Attack Mode itself: free on all plans, "known bots" (search crawlers, major webhook providers like Stripe) are auto-allowed, internal Vercel requests (crons, own functions) auto-allowed; docs recommend it for **incidents, not as a permanent setting** ([Attack Mode](https://vercel.com/docs/vercel-firewall/attack-challenge-mode), last_updated 2026-05-08).

### 2.3 What Cloudflare's free plan offers if it were the abuse layer instead

([Cloudflare WAF docs](https://developers.cloudflare.com/waf/rate-limiting-rules/); [Bot Fight Mode docs](https://developers.cloudflare.com/bots/get-started/bot-fight-mode/); checked July 2026)

- Free plan: ~5 custom security rules; **1 rate-limiting rule, IP-keyed only, 10-second window** — far weaker than what Upstash already gives the app.
- **Bot Fight Mode (free) runs outside the ruleset engine and cannot be skipped by path** — WAF skip/bypass rules do not exempt API routes from it. If it were ever enabled, it would recreate exactly the current problem one layer up. (Super Bot Fight Mode on Pro/Business is configurable but paid.)
- Per-record proxy status is standard: `api.handicappin.com` can be **DNS-only (grey cloud)** while apex/www stay orange — Cloudflare DNS-hosting does not force proxying.

---

## 3. Options

### Option A — Single host `handicappin.com`: Attack-Mode-off + ordered custom rules, path-scoped

Turn off the Attack Mode toggle. Recreate posture with custom rules: (1) WAF rate-limit on `path starts_with /api/v1` (and `/api/trpc` for the native app) → 429; (2) `bypass` on the same paths; (3) optional `challenge` rule on everything else (only if a standing challenge is truly wanted). Keep Cloudflare orange-cloud as-is. Replace challenge on the exempted path with Vercel WAF rate-limit + app-layer auth + Upstash per-user limits.

- **Pros:** zero DNS work; single hostname in consumer configs; fastest to ship (an afternoon of dashboard work); tRPC for native and `/api/v1` for external both fixed in one stroke.
- **Cons:** API remains behind the Cloudflare proxy → Vercel (and `getIdentifier`) still see Cloudflare IPs, so every per-IP control stays degraded and Vercel's DDoS heuristics stay aggravated (the likely original trigger for the standing challenge); the Attack-Mode-toggle footgun re-breaks the API on the next panic-enable; API edge posture permanently coupled to the browser site's; `bypass` isn't expressible in `vercel.json`, so config is dashboard-only either way.

### Option B — Dedicated `api.handicappin.com`, same Vercel project, grey-clouded (DNS-only) — RECOMMENDED

Add `api.handicappin.com` as an additional domain on the existing Vercel project via a **DNS-only** Cloudflare CNAME to Vercel. Turn the Attack Mode toggle off (mandatory under every option). Custom rules keyed on `host`: (1) rate-limit `host = api.handicappin.com` by IP + JA4 → 429; (2) `bypass` for that host; (3) any standing/incident challenge rule constrained to `host = handicappin.com`. Serve `/api/v1/*` route handlers from the same Next.js app; small middleware guard in `proxy.ts` to 404/redirect non-API paths on the api host. Native app can also move to the api host (or stay on the bypassed `/api/trpc` path — decide in the contract topic). Abuse layer on the exempted host: Vercel automatic DDoS (now seeing **real client IPs**) + Vercel WAF rate-limit backstop + Bearer/API-key auth 401ing junk cheaply + Upstash per-user/per-key sliding windows.

- **Pros:** restores true client IPs on API traffic (Vercel DDoS heuristics, WAF IP/JA4 rate limits, and `getIdentifier` all become meaningful); decouples API availability from the marketing site's edge posture — future site-side incident responses (challenge rules, even the Attack Mode toggle mistake) cannot take down the API or native app; clean semi-permanent hostname for consumer configs/docs/CORS/rate-limit-key design; no new deployment, no code duplication — same project, same tRPC+REST handlers; conforms to Vercel's support position (API path no longer proxy-stacked).
- **Cons:** DNS + domain-assignment work and host-based middleware (~1 day incl. rule testing); API traffic loses Cloudflare features (irrelevant: API responses are dynamic/uncacheable and Vercel's own DDoS protection is the supported layer); two hostnames to document; challenge posture for the browser site still must avoid the toggle (footgun persists for web users, but no longer for API consumers).

### Option C — Cloudflare as the API's edge/abuse layer (orange-cloud `api.` host, Cloudflare WAF/rate-limits, Vercel challenge off)

- **Pros:** one vendor for edge policy if the owner prefers Cloudflare; unmetered L3/4 DDoS.
- **Cons:** free-plan controls are weaker than what already exists (1 IP-keyed rate rule/10s window vs Upstash sliding windows); Bot Fight Mode is un-bypassable per path if ever enabled — recreates the exact current failure; still proxy-stacking on Vercel (unsupported, IP degradation persists at Vercel and in-app); two dashboards to keep coherent. Dominated by Option B unless a paid Cloudflare plan is already planned.

### Option D — Separate API deployment (new Vercel project or non-Vercel host) behind `api.handicappin.com`

- **Pros:** total isolation of edge posture, quotas, scaling; the "clean" third-party-platform topology long-term.
- **Cons:** not needed to clear this blocker — Option B achieves the isolation that matters (hostname + firewall scoping + IP fidelity) with zero deployment duplication; a second project means duplicated env, Sentry, cron, billing surface today. **Finding for the stack topic:** carving the hole is *not* fragile — the mechanisms (host-scoped custom rules, per-record grey-cloud, ordered bypass) are supported primitives — so edge ingress alone does **not** justify a separate deployment. The one caveat feeding that topic: Vercel firewall config is dashboard-state, not code (`bypass` unavailable in `vercel.json`), so the edge posture is unversioned in any option on Vercel.

---

## 4. Recommendation

**Option B**, sequenced so the blocker falls immediately and the hostname lands before any consumer config exists:

1. **Today (unblocks everything):** Vercel dashboard → Firewall: identify what's on (Attack Mode toggle vs challenge rule). Turn the toggle **off**. If a standing challenge is still wanted for the site, express it as a custom `challenge` rule scoped to `host = handicappin.com` with prior `bypass` rules for `/api/trpc`, Stripe/RevenueCat webhook paths, and (future) `/api/v1`. Verify with `curl -I https://handicappin.com/api/trpc/…` (expect no `x-vercel-mitigated: challenge`). Strongly consider whether a *standing* challenge is needed at all — Vercel's automatic DDoS mitigation is always on, the docs recommend challenge for incidents, and the standing challenge is what has been silently 429ing real users' tRPC calls.
2. **Before the fitness-app integration:** add `api.handicappin.com` to the project, grey-clouded; middleware host guard; firewall rules ordered rate-limit → bypass, keyed on the host; point the fitness app (and, when convenient, native `EXPO_PUBLIC_API_BASE_URL`) at it.
3. **Abuse layer replacing the challenge on the API host (defense in depth, all pieces exist):**
   - Vercel automatic DDoS with real client IPs (free, always-on);
   - one Vercel WAF rate-limit rule (IP + JA4, fixed window, 429, optional persistent deny) as the coarse pre-function backstop — remembering counters are per-region;
   - auth as the real gate: every `/api/v1` request must present a valid Bearer/API key; failures 401 before touching the DB;
   - Upstash sliding-window limiters extended in `lib/rate-limit.ts` with `user:{id}` / `key:{keyId}` identifiers (global and exact, unlike the edge counters), plus the existing plan/billing gating in `submitScorecard`.
4. **Runbook note (footgun):** "Never enable the Attack Mode toggle — it overrides all bypass rules and kills the API + native app. Use the host-scoped challenge rule instead." Record the firewall rule set in `docs/` since it cannot live in `vercel.json`.

**Confidence: high** on the direction (toggle-off + ordered host/path-scoped rules + grey-clouded api host); the mechanism claims are all primary-source-verified within the last 6 weeks. The exact dashboard state (which mitigation is enabled, which Vercel plan) is unverified from the repo and could shift step 1's details but not the destination.

## 5. Open questions

1. **What exactly is enabled in the Vercel dashboard** — Attack Mode toggle, a project-wide custom challenge rule, or automatic mitigation stuck in a loop because of Cloudflare-IP concentration? (5-minute dashboard check; determines whether step 1 is a toggle-off or a rule edit.)
2. **Which Vercel plan is the project on?** Hobby caps at 3 custom rules + 1 rate-limit rule (enough, barely: rate-limit + bypass + challenge); Pro gives 40 rate-limit rules + system bypasses. Affects headroom, not feasibility.
3. **Why is Cloudflare orange-clouded at all** — deliberate (caching? hiding origin?) or just the default when the zone was added? If nothing depends on it, grey-clouding *everything* is the simplest end-state and also fixes anonymous-IP bucketing for the contact form etc.
4. **Did Stripe/RevenueCat webhooks survive the challenge period?** Vercel claims known webhook providers are auto-allowed through Attack Mode — worth auditing delivery logs for the last months.
5. **Was there an actual attack** that motivated the challenge, and does the site need any standing challenge afterwards?
6. **CORS policy for `/api/v1`** if a browser-based consumer ever appears (native/fitness app doesn't need it) — decide when designing the REST contract.
7. **Native app base URL migration** — move native to `api.handicappin.com` now (one more EAS build) or leave on the bypassed `/api/trpc` path until the next release train?

## Sources

- [Vercel — Attack Mode](https://vercel.com/docs/vercel-firewall/attack-challenge-mode) (last_updated 2026-05-08)
- [Vercel — Firewall concepts (challenge/bypass semantics, JA4)](https://vercel.com/docs/vercel-firewall/firewall-concepts) (last_updated 2026-06-16)
- [Vercel — WAF Custom Rules (+ vercel.json subset)](https://vercel.com/docs/vercel-firewall/vercel-waf/custom-rules) (last_updated 2026-07-01)
- [Vercel — WAF Rate Limiting (limits/pricing table)](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting) (last_updated 2026-06-16)
- [Vercel — WAF System Bypass Rules (IP-only)](https://vercel.com/docs/vercel-firewall/vercel-waf/system-bypass-rules) (last_updated 2026-06-16)
- [Vercel staff on Attack Mode precedence over bypass rules — community discussion #7221](https://github.com/vercel/community/discussions/7221) (June 2024)
- [Vercel KB — Can I use a proxy on top of my Vercel deployment?](https://vercel.com/kb/guide/can-i-use-a-proxy-on-top-of-my-vercel-deployment) (undated; retrieved 2026-07-20)
- [Cloudflare — Rate limiting rules (plan entitlements)](https://developers.cloudflare.com/waf/rate-limiting-rules/) (retrieved 2026-07-20)
- [Cloudflare — Bot Fight Mode (cannot be path-skipped)](https://developers.cloudflare.com/bots/get-started/bot-fight-mode/) (retrieved 2026-07-20)
- Live probe of `https://handicappin.com` and `/api/trpc/*`, 2026-07-20 (429, `x-vercel-mitigated: challenge`, `server: cloudflare`)
- Repo: `apps/web/lib/rate-limit.ts`, `apps/web/proxy.ts`, `apps/web/vercel.json`, `apps/web/server/api/trpc.ts`, `apps/native/eas.json`
