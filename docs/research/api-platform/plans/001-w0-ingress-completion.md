# 001 — W0: Ingress incident completion + `api.handicappin.com` host

**Workstream:** W0 · **Status:** PARTIAL (in flight) · **Billing-gated:** No
**Depends on:** nothing (execute now) · **Blocks:** 005 (W4), 006 (W5) — both need a reachable cookie-less host; 004 (W2) needs the cookie-less prod canary.
**Coordinate with:** the `ingress-incident` agent (some steps already done — see Status below).

---

## Goal

Finish the production ingress incident and stand up `api.handicappin.com` as a grey-clouded (DNS-only) Cloudflare CNAME to the **same** Vercel project, so cookie-less Bearer requests reach the origin without the Cloudflare/Vercel challenge. Then right-size the replacement abuse layer (Bearer auth + Upstash per-identity limits + one Vercel WAF rate rule + spend alerts) and make the public API path **fail-closed**. This is incident response executed now, independent of the rest of the API project. Several steps are dashboard-side and owner-executed — they are collected in an **OWNER** section, not mixed into agent work.

## Background

Production (`handicappin.com`) sits behind Cloudflare (orange-cloud) → Vercel. The active mitigation was identified as Vercel's **Bot Protection managed ruleset set to Challenge** (not Attack Mode, not a custom rule). It served a 429 with `x-vercel-mitigated: challenge` (an HTML "Security Checkpoint") to every cookie-less request — which self-heals for browsers (they solve the JS challenge and get a 1-hour session) but breaks the native app's Bearer requests, direct API/cURL calls, and potentially some server-to-server webhooks. Bot Protection is documented-broken behind a reverse proxy (Cloudflare named): masked detection signals wrongly challenge legitimate users and proxy IP rotation forces re-challenges, which explains the intermittent behavior.

The incident itself has been **RESOLVED**: the owner flipped Bot Protection Challenge → Log on 2026-07-22 and cookie-less prod access was confirmed restored the same day (www tRPC returned 204, no `x-vercel-mitigated`). The Stripe live audit found no revenue events lost (4 `customer.created` events undelivered, ~nil impact, resend commands handed to the owner). The `webhook_events` ledger corroborates. The canary workflow was merged as PR #162 and is green.

What remains for this workstream: (1) **repo** hardening of `apps/web/lib/rate-limit.ts` (it fails **open** at every level today and `getIdentifier()` prefers a Cloudflare edge IP behind orange-cloud); (2) **repo** negative tests on the `apps/web/proxy.ts` host guard; (3) **owner** dashboard actions — Vercel spend alerts, the grey-clouded `api.handicappin.com` CNAME + Vercel custom domain, and the RevenueCat delivery-history check; (4) **docs** — record the firewall/dashboard state (it can't live in `vercel.json`) and the runbook rollback rule. The keystone runbook rule is: **never re-arm mitigation via the account-wide toggle — use a host-scoped custom challenge rule for `Host = handicappin.com`** so `api.` stays unchallenged.

## Scope (files/areas)

- `apps/web/lib/rate-limit.ts` (222 lines):
  - **Fail-closed on the public API path.** Today it fails open at every level — unset `RATE_LIMIT_ENABLED`, missing KV creds, and a Redis init error all silently allow (confirmed around `rate-limit.ts:44`, `:72`, `:130`). Make the **public `/api/v1` path** deny (or at minimum Sentry-alert) when the limiter can't run; keep the existing fail-open behavior only for first-party cookie paths if you must, but the public path must not silently allow.
  - **`getIdentifier()` (`:188-207`)** prefers `x-real-ip`, which behind orange-cloud is a Cloudflare edge IP — so all anonymous traffic shares a handful of buckets. After grey-clouding, ensure it resolves the real client IP (and, for the API host, prefer the authenticated principal — the `client_id` from 004/W2 — over IP once that exists).
  - **Assert the rate-limit env at startup** for the public path (via `apps/web/env.ts` / `@t3-oss/env-nextjs`; do not read `process.env` directly in app code).
- `apps/web/proxy.ts` — treat the host guard as a security boundary; add **negative tests** (absent / wrong / ported Host headers — CVE-2025-29927-class middleware history).
- `docs/` — a committed record of the current firewall/dashboard state and the rollback rule (firewall rules cannot live in `vercel.json`). Update `docs/research/api-platform/INGRESS_RUNBOOK.md` if the addendum needs the final state appended, and add the standing runbook rule.
- The external synthetic canary already exists (PR #162, green). Do **not** rebuild it; wire its alerting (Slack/email) if still stubbed, and treat it as permanent infra.

## Step-by-step (agent work)

1. Read `apps/web/lib/rate-limit.ts` end to end. Identify the three fail-open branches (`:44`, `:72`, `:130`) and `getIdentifier()` (`:188-207`).
2. Add a fail-closed policy for the public API path: a helper that, given the request is on the `/api/v1` surface (or `api.handicappin.com` host), returns "deny" when `RATE_LIMIT_ENABLED` is unset, KV creds are missing, or Redis init throws — and emits a Sentry breadcrumb/error. Leave cookie/first-party behavior untouched unless trivially shared.
3. Add a startup env assertion for the public-path rate-limit vars in `apps/web/env.ts` (server schema), so a misconfigured deploy fails loudly rather than failing open at request time.
4. Fix `getIdentifier()` so the API host derives the real client IP post-grey-cloud, and prefers the authenticated principal when present. Do not hardcode header names outside the env module where avoidable.
5. Add unit tests: (a) fail-closed branch on the public path for each of the three failure modes; (b) `getIdentifier()` returns the real client IP for representative header sets. Put them in `apps/web/tests/unit/`.
6. Add `proxy.ts` host-guard negative tests (absent / wrong / ported Host) in `apps/web/tests/unit/`.
7. Write/refresh the `docs/` firewall-state record: which mitigation is active (Bot Protection = Log), the staged host-scoped rollback challenge rule for `Host = handicappin.com`, the grey-cloud topology, and the standing rule "never use the account-wide toggle for routine mitigation."
8. Run the verification commands below; fix all lint/test failures.

## Binding conditions (verbatim from the ingress synthesis, Steps 5–6)

> **Step 5 — the replacement abuse layer, right-sized**: Bearer/API-key auth (401s junk) + Upstash per-user/per-key sliding windows extended in `apps/web/lib/rate-limit.ts` + **one** Vercel WAF rate-limit rule as 429 backstop + **Vercel spend limits/alerts** (black hat: the challenge was a free pre-function denial-of-wallet shield; its replacement must include billing controls, since Bearer 401s still cost a Supabase auth check). Two verification conditions on the Upstash layer: it currently **fails open** at every level (unset `RATE_LIMIT_ENABLED`, missing KV creds, Redis init error all silently allow) — make it fail-closed or at minimum Sentry-alerting for the public API path, and assert the env at startup. The red hat's over-engineering caution is adopted: **skip IP+JA4 WAF tuning and layered edge posture** until a genuine third party exists; auth + Upstash + one rate rule is sufficient for 12+ months of first-party-only consumers.

> **Step 6 — hardening and documentation**: treat the `proxy.ts` host guard as a security boundary with negative tests (absent/wrong/ported Host headers — CVE-2025-29927-class middleware history), decide the CORS posture for the api host at the same time, write the runbook rule ("never use the Attack Mode toggle — use the host-scoped challenge rule"), and **verify the 2024 Attack-Mode-precedence claim against current docs or empirically before encoding it as the runbook's central rule**.

> Firewall/bypass rules cannot be expressed in `vercel.json`; until scripted, the dashboard state must be documented in `docs/` alongside this synthesis.

Carried-forward dissent (state honestly in the docs, do not lose): Option B's isolation is **edge-only** — `api.` and the web/native product share one Vercel project (function concurrency, quotas, billing, deploys), so an API-host flood or a fitbull retry loop degrades the paying product; and shipped native binaries pin `handicappin.com`. Neither flips the decision; the shared-project blast radius is the first thing to revisit if a real third-party consumer appears.

## OWNER (dashboard actions — not agent work)

- [ ] **Vercel spend limits/alerts** — the challenge was a free denial-of-wallet shield; its replacement must include billing controls. Set spend alerts on the `handicappin` project.
- [ ] **`api.handicappin.com`** — create the grey-clouded (DNS-only) Cloudflare CNAME → Vercel, and add it as a Vercel custom domain on the same project. This is fitbull's base URL from its first commit.
- [ ] **One Vercel WAF rate-limit rule** as a 429 backstop on the API host (budget permitting — confirm plan tier / rule quota).
- [ ] **Stage (do not apply) the host-scoped rollback rule**: a custom **challenge** rule matching `Host = handicappin.com`, so the challenge can be re-armed in one click without touching `api.`.
- [ ] **RevenueCat** — check the webhook delivery history for the challenge window (manual; no CLI). Cross-check against `webhook_events WHERE provider = 'revenuecat'`. Resend any non-2xx deliveries.
- [ ] Resend the 4 undelivered Stripe `customer.created` events (`stripe events resend <evt_id> --live`).

## Non-goals

- Building a second Vercel project or a separate Hono/Fastify service (deferred behind split triggers — no stack change this cycle).
- IP/JA4 WAF tuning or layered edge posture (skip until a genuine third party exists).
- Any `/api/v1` route handlers (that is 005/W4). W0 only proves the host is reachable and hardens the abuse layer.
- Changing the auth model or adding `client_id` handling (that is 004/W2).

## Definition of done

- `rate-limit.ts` fails **closed** (or Sentry-alerts) on the public API path for all three failure modes; env asserted at startup; `getIdentifier()` returns real client IPs post-grey-cloud.
- `proxy.ts` host-guard negative tests exist and pass.
- Firewall/dashboard state + rollback rule + CORS posture documented in `docs/`; the "host-scoped rule, never the account-wide toggle" runbook rule recorded.
- Canary (PR #162) confirmed green and its alerting wired.
- OWNER items tracked (checkbox list above); `api.handicappin.com` reachable cookie-less with a Bearer token returning JSON (verified once the CNAME + domain land).

## Verification commands

```bash
pnpm test:unit          # host-guard negative tests + fail-closed rate-limit branches + getIdentifier
pnpm lint               # no lint errors
```

Manual: cookie-less `curl` with a valid Bearer token against `https://api.handicappin.com/api/trpc/course.getCourseById` (or a `/api/v1/health` stub once 005 lands) returns JSON, not a 429 HTML challenge. The scheduled canary stays green on the cookie-less prod probe.
