# Ingress Firewall & Edge State (handicappin.com / api.handicappin.com)

**Last updated:** 2026-07-27 (api-platform subplan 001 / W0)
**Why this file exists:** Vercel firewall/bot-management rules and Cloudflare
proxy modes **cannot be expressed in `vercel.json`** — they are dashboard
state. Until the ruleset is scripted (Vercel REST API / Terraform), this
committed record is the source of truth for what the edge is configured to
do. Update it whenever the dashboard changes.

Companion research corpus (incident narrative, evidence, audit queries):
`docs/research/api-platform/INGRESS_RUNBOOK.md` and `DECISIONS.md` §4
(kept alongside the api-platform plans; not yet committed to the repo).

---

## Topology

```
Browsers/native  ──▶  Cloudflare (zone handicappin.com)  ──▶  Vercel (project: handicappin)
                       - handicappin.com / www: ORANGE-CLOUD (proxied)
                       - api.handicappin.com:  GREY-CLOUD (DNS-only CNAME → Vercel)  [owner: pending]
```

- `handicappin.com` / `www.handicappin.com`: web product + the shipped native
  binaries (which pin `handicappin.com` — the main host's edge posture stays
  load-bearing until a forced-upgrade mechanism exists).
- `api.handicappin.com`: the public API host (fitbull's and the native app's
  base URL going forward). **Grey-clouded (DNS-only)** so cookie-less Bearer
  requests reach Vercel directly — no Cloudflare or Vercel challenge in the
  path, and Vercel sees real client IPs.

## Current firewall state (Vercel → project `handicappin`)

| Control | State | Notes |
|---|---|---|
| Bot Protection (managed ruleset) | **Log** (flipped from Challenge 2026-07-22) | The 2026-06/07 incident: Challenge served 429 HTML "Security Checkpoint" to every cookie-less request. Documented-broken behind a reverse proxy (Cloudflare named) — do not re-enable Challenge while orange-cloud fronts the zone. |
| Attack Mode | **Off** | Never use for routine mitigation — see the standing rule below. |
| Custom WAF rules | Staged rollback rule only (see below) | Plan tier is **Pro**; confirm rule budget before adding rules. |
| WAF rate-limit rule (429 backstop on the API host) | **Owner item — not yet applied** | One rule only; skip IP/JA4 tuning until a genuine third party exists. |
| Spend limits/alerts | **Owner item — not yet applied** | The challenge was a free denial-of-wallet shield; its replacement must include billing controls. |

## Staged rollback rule (re-arming mitigation)

A host-scoped custom WAF **challenge** rule matching `Host = handicappin.com`,
**staged in the dashboard but not applied**. If abuse resumes, apply it —
one click — to re-challenge the web host only, while `api.handicappin.com`
(grey-clouded, Bearer + Upstash + WAF-rate-rule protected) keeps serving the
native app and fitbull.

## Standing rule (the one that must never be broken)

> **Never re-arm mitigation via an account/project-wide toggle** (Attack
> Mode, or Bot Protection set back to Challenge). **Always use the
> host-scoped challenge rule for `Host = handicappin.com`** so the API host
> stays unchallenged. The account-wide toggles are exactly what broke the
> native app's Bearer path and dropped webhook deliveries in the 2026-06/07
> incident.

## Replacement abuse layer (instead of the challenge)

1. **Bearer/API-key auth** — junk traffic gets a cheap 401.
2. **Upstash per-identity sliding windows** (`apps/web/lib/rate-limit.ts`) —
   **fail-closed on the public API surface** (`/api/v1` paths and the
   `api.handicappin.com` host): if `RATE_LIMIT_ENABLED` is unset, KV creds
   are missing, or Redis init/requests throw, public API requests are DENIED
   and Sentry is alerted. First-party cookie endpoints keep fail-open (with
   Sentry alerting at init). `RATE_LIMIT_ENABLED` must be explicitly set in
   production — `apps/web/env.ts` fails the deploy otherwise.
3. **One Vercel WAF rate-limit rule** as a 429 backstop on the API host
   (owner item).
4. **Vercel spend limits/alerts** (owner item).

Anonymous identity for limiting is the **real client IP**:
`cf-connecting-ip` (when the request traversed orange-cloud Cloudflare) →
`x-real-ip` (direct-to-Vercel, incl. the grey-clouded API host) → last
`x-forwarded-for` hop. The old `x-real-ip`-first order bucketed all
anonymous orange-cloud traffic into a handful of Cloudflare edge IPs.

## CORS posture for `api.handicappin.com`

**No permissive CORS.** The API host serves non-browser clients only (native
app, fitbull's Convex backend, server-to-server) authenticating with Bearer
tokens — no cookies, so CSRF-via-CORS is not in play and no
`Access-Control-Allow-Origin` header is emitted. Decision recorded
2026-07-27: revisit only if a browser-based consumer appears; if that
happens, use an explicit origin allowlist, never `*` — and note `*` with
`Authorization` headers is both dangerous and spec-hostile.

## Monitoring

- **External canary:** `.github/workflows/ingress-canary.yml` (merged PR
  #162) probes the main host cookie-less every 15 min from a GitHub runner
  and fails on any challenge/HTML response. Slack alerting is wired in the
  workflow and activates once the `SLACK_WEBHOOK_URL` repo secret is set
  (owner item). When `api.handicappin.com` is live, remove
  `continue-on-error` from its probe step so the API host becomes a hard
  gate.
- **Sentry:** `rate-limit-fail-closed` / `rate-limit-unavailable` events
  fire whenever the limiter infrastructure is down (see
  `apps/web/lib/rate-limit.ts`).

## Middleware host guard

`apps/web/proxy.ts` rejects requests whose `Host` header is absent, unknown,
or carries a non-default port (allowlist in `apps/web/lib/host-guard.ts`:
production hosts, `*.vercel.app` deployments, local dev). Treated as a
security boundary with negative tests
(`apps/web/tests/unit/proxy-host-guard.test.ts`,
`tests/unit/lib/host-guard.test.ts`).

## Carried-forward dissent (do not lose)

The `api.` host's isolation is **edge-only**: it shares one Vercel project
with the web/native product (function concurrency, quotas, billing,
deploys), so an API-host flood or a fitbull retry loop degrades the paying
product; and shipped native binaries pin `handicappin.com`. Neither flips
the decision — but the shared-project blast radius is the first thing to
revisit if a real third-party consumer appears.

## Owner checklist (dashboard actions still open as of 2026-07-27)

- [ ] Grey-clouded (DNS-only) `api.handicappin.com` CNAME → Vercel + add as
      Vercel custom domain.
- [ ] Vercel spend limits/alerts on project `handicappin`.
- [ ] One WAF rate-limit rule (429 backstop) on the API host.
- [ ] Stage (do not apply) the `Host = handicappin.com` challenge rule.
- [ ] `SLACK_WEBHOOK_URL` repo secret for canary paging.
- [ ] Set `RATE_LIMIT_ENABLED` explicitly in Vercel production env (deploys
      fail env validation without it after subplan 001 lands).
- [ ] RevenueCat webhook delivery-history check for the challenge window;
      resend the 4 undelivered Stripe `customer.created` events.
