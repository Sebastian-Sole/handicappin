# Green Hat Review — api-ingress-and-abuse

**Verdict: agree** (Option B is a sound destination) — but the option space was narrower than it needed to be, and at least one simpler end-state was demoted to an "open question" when it deserved to be a full option.

## 1. The missing Option E: grey-cloud the ENTIRE zone (or move DNS off Cloudflare)

The research's own facts point at a simpler world than any of its four options: Vercel doesn't support proxy-stacking, Cloudflare free-plan adds almost nothing for a dynamic app on Vercel (Vercel already terminates TLS, has a CDN, and has always-on DDoS mitigation), and the orange cloud is *probably what caused the challenge in the first place*. Yet "grey-cloud everything" appears only as open question #3. If nothing depends on the proxy — and no evidence was found that anything does — the whole problem disappears:

- No proxy-stacking anywhere, real client IPs on ALL traffic (fixing the contact-form/anonymous bucketing bug the research itself found in `getIdentifier()`),
- One edge vendor, one dashboard, no "two postures to keep coherent",
- Option B then shrinks to "add a domain alias + host guard", or possibly isn't needed at all.

This should be resolved *before* building B, not after. If the answer is "orange cloud is a zone default nobody chose", Option E dominates B on simplicity. (B still wins if origin-hiding or CF caching of the marketing site is deliberately wanted — but nobody has established that it is.)

## 2. Reframe: does the API have to enter through the Next.js edge at all?

All four options assume the API ingress is the Vercel deployment. The stack already contains a second, directly-reachable, challenge-free API host: **Supabase** (`*.supabase.co`), with Bearer auth, RLS, and its own rate limiting. A Supabase Edge Function fronting the extracted `submitScorecard` core would sidestep Vercel *and* Cloudflare entirely — zero edge-rule archaeology, zero Attack-Mode footgun exposure. I don't think this beats B (it fragments the server code and duplicates the billing-gate path, and the stack topic favors one deployment), but for a "first consumer is our own fitness app" scope it's a legitimate escape hatch that was never priced. Worth one paragraph of rejection-with-reasons in the final decision doc.

## 3. The "dashboard-state can't live in the repo" con is solvable, not structural

The research treats unversioned firewall config as an accepted residual risk because `vercel.json` can't express `bypass`. But the **Vercel REST API manages firewall custom rules programmatically** (and there's a community Terraform provider). A ~50-line `scripts/edge/apply-firewall-rules.ts` run in CI (or on demand) makes the ruleset declarative, diffable, and PR-reviewable — the exact property the research laments losing. This converts a "con of every Vercel option" into a small task. Verify the current API surface (5 minutes), then stop calling this a structural limitation.

## 4. The Attack-Mode footgun deserves a tripwire, not just a runbook line

"Write a runbook rule: never use the toggle" is a human-memory control against a panic-time action — the weakest possible mitigation for the *residual risk the research itself ranks highest*. Cheaper and stronger: a scheduled synthetic check (existing cron/CI or an Upstash-triggered ping) that curls `api.handicappin.com/api/v1/health` with a Bearer token every few minutes and pages via Sentry when it sees 429/HTML. The footgun becomes a 5-minute detectable incident instead of a silent multi-day outage — which is exactly how the *current* outage (native app dead in prod, apparently unnoticed) happened.

## 5. First-party consumers unlock abuse layers the research didn't consider

Both near-term consumers are the same developer's apps. That means **app attestation (Apple App Attest / Play Integrity) or a signed-request HMAC** are available as the primary junk filter — abuse controls keyed to *the app*, not the IP. This weakens the load-bearing role of "real client IPs" in the recommendation (still worth having, but it's defense-in-depth, not the linchpin) and is the natural bridge to real API keys when third parties arrive. A sentence in the abuse-layer design acknowledging this sequencing would future-proof step 3.

## Bottom line

Option B is right *given the options considered*, and nothing above blocks starting step 1 (toggle off) today. But answer "why is Cloudflare orange-clouded?" first — it's a 5-minute question that decides whether the simpler Option E collapses most of B's remaining work — and turn the two soft mitigations (runbook, dashboard-state) into hard ones (synthetic monitor, rules-as-code script).
