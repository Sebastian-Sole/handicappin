# Yellow Hat review — api-ingress-and-abuse

**Perspective:** benefits and value. Why the recommendation works, what it unlocks, why the cost is worth it.
**Verdict:** AGREE (Option B, sequenced as recommended).

## Why this recommendation is unusually high-value

### 1. Step 1 alone is a production incident fix disguised as platform work

The single best fact in this research: turning the Attack Mode toggle off is a **zero-code, same-day action that repairs three broken things at once** — the shipped native app's entire Bearer-token path (unreachable in prod today per `apps/native/eas.json` + `apps/web/server/api/trpc.ts`), real browser users whose 1-hour challenge session expires mid-round ("Unexpected token '<'" tRPC failures already observed on 2026-07-16), and every future non-browser consumer. Most platform-enablement work has payoff months out; this one pays off before lunch. The fitness-app project effectively gets its hardest prerequisite for free because it was owed anyway.

### 2. Option B buys ~90% of Option D's isolation at ~5% of its cost

The dedicated grey-clouded `api.handicappin.com` on the *same* Vercel project is the sweet spot on the value curve:

- **Blast-radius decoupling**: future site-side incident responses (challenge rules, even a mistaken toggle-flip's *rule-based* equivalent) can no longer take down the API or the native app. The marketing site and the API get independent edge postures without a second deployment, second env surface, second Sentry project, or duplicated cron/billing wiring.
- **A hostname is an asset, not just plumbing.** `api.handicappin.com` becomes the stable anchor for consumer configs, docs, CORS policy, API-key scoping, status-page line items, and eventually per-host observability. Landing it *before* the first external consumer exists means zero migration debt later — every future integration is born pointing at the right place.
- **If the platform ambition grows into Option D someday**, the hostname, firewall rules, host-guard middleware, and consumer configs all carry over unchanged — only the DNS target moves. Option B is a no-regret stepping stone, not a dead end.

### 3. The grey-cloud move fixes latent bugs nobody asked about

Restoring real client IPs is a quiet compounding win far beyond ingress:

- `getIdentifier()` in `apps/web/lib/rate-limit.ts` stops bucketing all anonymous traffic into a handful of Cloudflare egress IPs — the contact form and OAuth-callback per-IP limits become *correct* for the first time, on the API host immediately and everywhere if the open question "grey-cloud everything" resolves yes.
- Vercel's DDoS heuristics stop seeing all traffic concentrated on a few source IPs — plausibly removing the very aggravation that triggered the standing challenge. The fix may dissolve the original disease, not just the symptom.
- The project exits Vercel's "unsupported proxy-stacking" posture on the API path, which means **support tickets during a future incident won't start with "disable your proxy first."** That's insurance you only appreciate at 2 a.m.

### 4. The replacement abuse layer is almost entirely already built

The layered posture (Vercel auto-DDoS + one WAF rate-limit rule + auth-401s-junk + Upstash per-user/per-key sliding windows) requires roughly one dashboard rule and ~10 lines per endpoint class in `lib/rate-limit.ts`. It's also *strictly better* than the challenge it replaces: the challenge was an indiscriminate wall that blocked legitimate clients and (per the open question) may have been silently degrading webhook delivery; the replacement is precise, per-identity, and observable. Abuse control moves from "hope the wall holds" to keyed, tunable, fail-open limits the team already knows how to operate.

### 5. The research de-risks the *stack* decision too

The finding that the carve-out uses only supported primitives (host-scoped rules, ordered bypass, per-record grey-cloud) is a gift to the adjacent topic: it removes "edge ingress" as a justification for a separate API deployment or stack change. That keeps the answer to the owner's headline question — "does this require changing the tech stack?" — trending firmly toward *no*, which is the cheapest possible outcome.

### 6. Even the residual risks convert into cheap durable assets

The Attack-Mode footgun and dashboard-only config are real, but their mitigations (a runbook line + a `docs/` record of the ruleset) cost an hour and become permanent operational documentation the project currently lacks entirely. First edge-posture runbook, purchased at a discount.

## Best realistic outcome

Within a week: native app works in prod, mid-round tRPC failures gone, webhooks verified healthy, `api.handicappin.com` live with correct per-client rate limiting — and the fitness-app integration starts against a stable, documented ingress instead of negotiating with a challenge wall. Total spend: an afternoon of dashboard work plus ~1 day of DNS/middleware/rules.

## Must-address (to protect the value)

1. Do the 5-minute dashboard check (toggle vs rule vs auto-mitigation) *before* announcing the fix — step 1's value claim depends on it being the toggle/rule.
2. Audit Stripe/RevenueCat webhook delivery logs for the challenge period — if deliveries were dropped, that's revenue-affecting and raises the urgency (and the credit this fix deserves).
3. Write the "never use the Attack Mode toggle" runbook line *the same day* the toggle goes off — the footgun is the one thing that can claw back the whole win.
