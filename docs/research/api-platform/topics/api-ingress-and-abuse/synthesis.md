# Synthesis — api-ingress-and-abuse

**Verdict: CONSENSUS** (6 agree, 1 mixed; the mixed review disputes sequencing and control strength, not the destination).

## Decision

Adopt **Option B**: a dedicated `api.handicappin.com` hostname on the same Vercel project, added as a **grey-clouded (DNS-only) Cloudflare CNAME**, with the browser challenge replaced on that host by an auth-and-rate-limit abuse layer. The naive framing in the topic question — "challenge-mode bypass rules scoped to `/api/v1/*`" — is not implementable: Vercel Attack Mode overrides all bypass rules, so the challenge must come off (or be replaced by a host-scoped custom challenge rule) rather than be tunneled through.

Every perspective — including the two structurally negative ones — accepts this topology. The black hat's objections and the pre-mortem's failure chains all target **how** the plan executes (sequencing, detection, control strength), and every one of them is absorbable as a condition without changing the destination. No perspective argued for Option A (main-host-only rules), C (new vendor), or D (separate deployment); the blue hat explicitly noted that no plausible open-question outcome flips B to any alternative.

## The decision, resequenced (conditions absorbed)

The original 4-step plan survives, but the panel unanimously reordered it. Toggle-off is no longer step 1; verification and detection come first.

**Step 0 — three 5-minute checks BEFORE touching anything** (demanded by all seven perspectives in some form):
1. **Vercel dashboard**: which mitigation is actually enabled — Attack Mode toggle, a project-wide custom challenge rule, or automatic mitigation aggravated by Cloudflare-IP concentration. This determines whether the fix is toggle-off, rule-edit, or grey-cloud-first. Response headers cannot distinguish these; nobody has looked yet.
2. **Plan tier and rule quotas**: Hobby's 3-custom-rules + 1-rate-limit-rule cap is exactly consumed by the proposed ruleset with zero incident headroom. Confirm the tier before designing the ruleset.
3. **Cloudflare**: why is the zone orange-clouded at all, and was there an actual attack (firewall analytics/traffic history)? If orange-cloud is a zone-add default with no dependency (page rules, redirects, origin-hiding), grey-cloud broadly — this simplifies the whole topology and may dissolve the original cause of the challenge (green hat's "Option E" is absorbed here as a conditional simplification of B, not a competitor).

**Step 1 — ship the tripwire before changing the firewall** (black hat, green hat, blue hat, pre-mortem — the single most convergent condition): an **external, non-Vercel-hosted synthetic canary** making cookie-less requests to `/api/trpc` and the future API paths every few minutes, asserting no `x-vercel-mitigated: challenge` / no HTML, paging on failure. The current outage went unnoticed for an unknown period precisely because no such tripwire exists. A runbook sentence is not a control against a one-click, silent, panic-time toggle; the canary is.

**Step 2 — unblock ingress today**: based on Step 0's findings, turn Attack Mode off (or edit the rule, or grey-cloud), with a **host-scoped challenge rule for `handicappin.com` prepared as instant rollback** — non-optional until the "was there an attack" question is answered. This immediately repairs the shipped native app's Bearer path and the 1-hour-expiry mid-round browser failures. This is an incident fix and should not wait on the fitness-app work.

**Step 3 — audit Stripe/RevenueCat webhook delivery logs for the entire challenge period, now**, while replay windows are still open (five of seven perspectives). Silent billing-event loss would change priorities and must be ruled out before building API plan-gating on possibly-divergent billing state.

**Step 4 — `api.handicappin.com` as a HARD GATE, not a sequence position** (pre-mortem): the fitness app's base URL is `api.handicappin.com` from its first commit. The integration must never ship configured against `handicappin.com`, or API availability is permanently re-coupled to the marketing site's edge posture — the exact thing Option B exists to prevent. Grey-clouding also fixes the latent `getIdentifier()` bug (`apps/web/lib/rate-limit.ts:188-207` prefers `x-real-ip`, which behind orange-cloud is a Cloudflare edge IP — all anonymous traffic shares a handful of rate buckets).

**Step 5 — the replacement abuse layer, right-sized**: Bearer/API-key auth (401s junk) + Upstash per-user/per-key sliding windows extended in `apps/web/lib/rate-limit.ts` + **one** Vercel WAF rate-limit rule as 429 backstop + **Vercel spend limits/alerts** (black hat: the challenge was a free pre-function denial-of-wallet shield; its replacement must include billing controls, since Bearer 401s still cost a Supabase auth check). Two verification conditions on the Upstash layer: it currently **fails open** at every level (unset `RATE_LIMIT_ENABLED`, missing KV creds, Redis init error all silently allow) — make it fail-closed or at minimum Sentry-alerting for the public API path, and assert the env at startup. The red hat's over-engineering caution is adopted: **skip IP+JA4 WAF tuning and layered edge posture** until a genuine third party exists; auth + Upstash + one rate rule is sufficient for 12+ months of first-party-only consumers.

**Step 6 — hardening and documentation**: treat the `proxy.ts` host guard as a security boundary with negative tests (absent/wrong/ported Host headers — CVE-2025-29927-class middleware history), decide the CORS posture for the api host at the same time, write the runbook rule ("never use the Attack Mode toggle — use the host-scoped challenge rule"), and **verify the 2024 Attack-Mode-precedence claim against current docs or empirically before encoding it as the runbook's central rule** (blue hat: the keystone claim traces to a June-2024 community post; 2026 docs are consistent with but never restate it). Optionally make the firewall ruleset declarative via Vercel's REST API / Terraform (green hat) — worthwhile, not blocking.

## Answer to the topic question

- **Edge configuration**: not bypass-rules-under-challenge (impossible — Attack Mode overrides bypass); instead a dedicated `api.handicappin.com` grey-clouded past Cloudflare into the same Vercel project, with host-keyed firewall rules, after the standing challenge on the main host is removed or narrowed to a host-scoped rule.
- **Replacement abuse layer**: both code and edge, but minimal — Bearer/API-key auth + Upstash per-identity limits (made fail-closed/alerting for the public path) + one Vercel WAF rate-limit rule + spend alerts + Vercel automatic DDoS (which only works once it sees real client IPs, i.e., after grey-clouding). Cloudflare WAF plays no role on the API host.

## Surviving dissent (does not block, must be carried forward honestly)

The black hat's residual position, unrebutted by any other perspective: **Option B's isolation is edge-only.** Same Vercel project means shared function concurrency, quotas, billing, and deploys — an API-host flood or a misbehaving fitness-app retry loop degrades the paying web/native product. And shipped native binaries pin `handicappin.com`, so the main host's bypass rules on the degraded orange-clouded path stay load-bearing indefinitely until a forced-upgrade mechanism exists. Neither point flips the decision (Option D's full isolation costs ~20x for the current threat model), but both must be stated honestly in the stack-topology decision this topic feeds, and the shared-project blast radius is the first thing to revisit if a real third-party consumer materializes.

## Notes for the executor

- Steps 0–3 are an **incident response**, not API-platform work — execute them this week regardless of when the fitness-app integration starts.
- The urgency claim ("native app broken for users today") rests on `apps/native/eas.json` pinning `https://handicappin.com` plus the live-verified 429; no Sentry/usage data confirmed real users are currently affected. Checking native-app usage during Step 0 would calibrate urgency but must not delay it.
- Firewall/bypass rules cannot be expressed in `vercel.json`; until scripted, the dashboard state must be documented in `docs/` alongside this synthesis.

## Panel tally

| Perspective | Verdict | Disposition of concerns |
|---|---|---|
| white-hat | agree | Step 0 checks; webhook audit; Cloudflare dependency check — absorbed |
| red-hat | agree | Execute toggle-off as incident; orange-cloud question; plan tier — absorbed; over-engineering caution adopted in Step 5 |
| black-hat | mixed | Reordering, canary, spend caps, webhook audit, host-guard tests — all absorbed as conditions; shared-project blast radius carried as dissent |
| yellow-hat | agree | Step 0 check; webhook audit; same-day runbook — absorbed |
| green-hat | agree | Orange-cloud-first; canary; declarative rules optional — absorbed (whole-zone grey-cloud folded into Step 0.3) |
| blue-hat | agree | Step 0 gating; attack-history check; canary; webhook audit; verify 2024 claim — absorbed |
| pre-mortem | agree | Canary-before-firewall; step-2-as-hard-gate; fail-open rate limiter; webhook audit — absorbed |
