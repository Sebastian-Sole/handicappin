# Pre-mortem review — api-ingress-and-abuse

**Perspective:** It is January 2027. The fitness-app integration shipped in August 2026 on the back of this recommendation and it failed or badly underdelivered. What happened?

**Verdict: agree** — with the topology. Option B is correct and the Attack-Mode-toggle finding is genuinely load-bearing. But every failure below happens *despite* the recommendation being followed as written, because the plan's controls for its own known risks are the weakest kind (a runbook sentence, an "optionally", a "before the fitness integration"). The pre-mortem is about operational preconditions, not architecture.

---

## The failure narrative

### October 2026 — Step 2 quietly never happened

Step 1 was an afternoon of dashboard work and it *worked*: Attack Mode off, host-scoped challenge rule, bypasses for `/api/trpc` and webhooks. The native app came back to life. And that success killed step 2. The recommendation's own sequencing said step 1 "alone unblocks the native app and all external clients today" — so when the fitness-app deadline compressed, `api.handicappin.com` was descoped as "nice-to-have hardening" and the integration launched pointed at `https://handicappin.com/api/v1`. Nothing in the plan made step 2 a hard gate; it was ordering, not a precondition. From that day the API's availability was permanently coupled to the marketing site's edge posture, and every per-IP control still saw Cloudflare edge IPs — exactly the two problems Option B existed to solve, both alive in production.

### November 2026 — the panic-toggle, exactly as predicted

A credential-stuffing wave hit the login page (or a scraper hammered course pages — it doesn't matter). Sebastian, or future-Sebastian-at-2am, opened the Vercel dashboard and saw the big red **Attack Mode** button. The runbook rule — "never use the toggle, use the host-scoped challenge rule" — lived in `docs/`, written five months earlier, and the entire property of the toggle is that it *overrides all bypass rules silently*. He clicked it. The API died instantly: native app, fitness app, Stripe webhooks behind the bypass — all serving 429 challenge HTML.

**And nothing alerted.** This is the part the recommendation walks straight past: the failure mode is a 429 with an HTML body, which clients experience as JSON-parse errors, which Sentry buckets as client-side noise. We have *direct proof* the monitoring gap is real: the research itself notes the production native app's entire Bearer path had been dead behind the challenge for an unknown period as of 2026-07-20 **and nobody had noticed**. The same blindness, unfixed, meant the November outage ran ~4 days. The fitness app's scorecard submissions failed silently in its retry queue; some users' rounds were lost; the fitness-app side (same developer, but a different codebase with different assumptions) had no contract for "the API returns HTML now."

### Throughout — the "replacement abuse layer" was partially fiction

The challenge was removed and replaced, per the recommendation, with "layers that all already exist." Except the load-bearing layer — Upstash per-user/per-key limits in `apps/web/lib/rate-limit.ts` — **fails open by design at every level**: `RATE_LIMIT_ENABLED !== 'true'` → bypass limiter; missing `KV_REST_API_URL`/`KV_REST_API_TOKEN` → bypass limiter; Redis init throw → bypass limiter. All of it logs a warning nobody reads and allows everything. An env-var drift during a Vercel project settings cleanup in September turned the API's primary abuse layer into a no-op for six weeks. Meanwhile the single Vercel WAF rate-limit rule — the coarse backstop — turned out to be constrained by plan limits nobody verified (the open question "which plan?" was never answered; Hobby caps at 1 rate-limit rule and 3 custom rules, which the ordered rate-limit → bypass → challenge design consumes entirely, leaving zero headroom for the first incident-specific rule).

Also unresolved from the open-questions list: whether Stripe deliveries had already been eaten during the original challenge period. They had — two subscription-renewal webhooks from October 2025 were never replayed, and the reconciliation surfaced as a billing-support incident in December.

### The quiet compounding factor

`getIdentifier()` in `lib/rate-limit.ts` prefers `x-real-ip`. On the still-orange-clouded single host, that's a Cloudflare edge IP: ~all anonymous traffic shares a handful of buckets. The contact-form limit (3/min) started false-positiving legitimate users the first time anyone linked the site anywhere busy, which is what prompted the dashboard fiddling that preceded the November toggle-click. The failure chain literally started from the per-IP degradation the deferred step 2 would have fixed.

---

## What actually went wrong, traced to the recommendation

1. **Its only control for its own top-named risk (the toggle footgun) is documentation.** A runbook sentence is the weakest control class, deployed against a one-click, silent, bypass-overriding failure mode, on a solo project where the person in the incident *is* the person who'd have to remember the rule. The recommendation names the risk and then under-mitigates it.
2. **Sequencing without gates invites descoping.** "Step 1 unblocks everything today" + "step 2 before the fitness integration" reads, under deadline pressure, as "step 2 optional." The plan never states the binding constraint: *the fitness app must never be configured against handicappin.com*.
3. **No detection layer anywhere in the plan.** Every failure mode in this topic — toggle re-enable, rule reorder, Cloudflare-side change, challenge re-trigger — presents as cookie-less requests getting HTML. The plan removes the challenge but adds no canary that would notice its return. The native app's months(?)-long silent breakage is the existence proof that this *will* go unnoticed.
4. **"Layers that all already exist" weren't audited.** The Upstash layer's fail-open posture and env-var dependence, and the unverified Vercel plan limits, mean the post-challenge abuse stack was specified by name rather than by verified behavior.

---

## Preconditions to avoid this future (must-hold)

1. **Synthetic cookie-less canary before anything else.** An external cron (not Vercel-hosted) curls the API host and `/api/trpc` health endpoint every few minutes with no cookies, asserts a JSON (non-HTML, non-429-challenge) response, and pages on failure. This is the cheapest item in the whole plan and it neutralizes the toggle footgun, Cloudflare drift, and rule-reorder mistakes simultaneously — the runbook rule becomes defense-in-depth instead of the only line. Ship it *before* touching the firewall, so it also confirms the fix.
2. **Step 2 is a hard gate, not a sequence position.** The fitness app's base URL is `api.handicappin.com` from its first commit; the integration does not ship against `handicappin.com`. Write that as a constraint in the integration plan, not as ordering prose.
3. **The replacement abuse layer must be verified fail-safe, not named.** For the public API path specifically: `lib/rate-limit.ts` fail-open behavior either becomes fail-closed (or at minimum Sentry-alerting) for `/api/v1`, and `RATE_LIMIT_ENABLED` + Redis creds are asserted at startup in prod. Simultaneously answer the two 5-minute open questions (which mechanism is on; which Vercel plan) before the ruleset is designed — plan limits change the design, not just the details.

Secondary (should-hold): audit Stripe/RevenueCat webhook delivery logs for the entire challenge period now, while replay windows are still open.
