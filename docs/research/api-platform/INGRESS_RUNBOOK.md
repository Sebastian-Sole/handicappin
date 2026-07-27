# Ingress Incident Runbook

**Status:** RESOLVED 2026-07-22 (Bot Protection Challenge → Log; cookie-less access restored). Repo hardening landed 2026-07-27 — see the final addendum. Standing edge/firewall state now lives in the committed `docs/ingress-firewall-state.md`.
**Opened:** 2026-07-22 (challenge confirmed live on `/` and `/api/trpc/*`).
**Owner action required:** yes — see [SEBASTIAN MUST DO IN DASHBOARD](#sebastian-must-do-in-dashboard).
**Source of truth for the decision:** `DECISIONS.md` §4 and `topics/api-ingress-and-abuse/synthesis.md`. This runbook is the *execution* companion — it resequences the synthesis into do-this-now steps and records the read-only audit findings gathered during prep.

---

## TL;DR

Production (`handicappin.com`) sits behind Cloudflare (orange-cloud) → Vercel. Vercel is serving a **429 with `x-vercel-mitigated: challenge`** (the "Vercel Security Checkpoint" HTML) to every request that arrives **without a challenge-session cookie**. Browsers self-heal (they solve the JS challenge, get a 1-hour session). Everything else — the **native app's Bearer requests**, direct API/cURL calls, and potentially some server-to-server webhooks — gets an HTML challenge page instead of JSON.

The fix is NOT a path-scoped bypass rule (that is not implementable — see [the Attack-Mode precedence finding](#load-bearing-claim-verified-attack-mode-vs-bypass-rules)). The fix is: **identify which mitigation is on → stand up the external canary → remove/narrow the challenge with a host-scoped rollback rule prepped → create a grey-clouded `api.handicappin.com` → audit webhook delivery.**

---

## What we verified during prep (read-only)

| Fact | Finding |
|---|---|
| Vercel project | `handicappin`, team `sebastiansoles-projects`, latest prod URL `https://www.handicappin.com`, Node 20.x. Repo is **not** linked locally (no `.vercel/`), so `vercel env ls` / firewall CLI need a `vercel link` first. |
| Vercel plan tier | **Not determinable from the CLI read-only.** Must be read in the dashboard — it governs the WAF rule budget (see checklist). Hobby = 3 custom rules + 1 rate-limit rule total; that budget is fully consumed by the planned ruleset with zero incident headroom. |
| Stripe CLI mode audited | **Sandbox / test mode** (`acct_1S0pJCLtmYX7wPWu`, "Sole Innovations sandbox") — this is the CLI's default profile and what local `.env` uses (price IDs carry the `LtmYX7wPWu` account suffix). |
| Stripe sandbox webhook endpoints | **None configured** (`webhook_endpoints list` → empty). |
| Stripe sandbox event history | **2 events ever**, both `customer.subscription.deleted` (2026-07-09, 2026-07-20), both `pending_webhooks=0`. No failed/pending deliveries. Nothing lost here. |
| Stripe LIVE account | `acct_1S0pJ5Lk50S7inDF` ("Sole Innovations"). **Could not be audited** — the CLI's live restricted key **expired 2026-07-09** and the profile is not selectable without an interactive `stripe login`. **This is the account that matters for prod webhook damage and it is currently un-audited.** |
| Webhook routes in the app | Stripe: `apps/web/app/api/stripe/webhook/route.ts`. RevenueCat: `apps/web/app/api/webhooks/revenuecat/route.ts`. Internal status: `apps/web/app/api/billing/webhook-status/route.ts`. |
| Internal webhook ledger | Table `webhook_events` (`apps/web/db/schema.ts:450`) records every processed event: `event_id`, `event_type`, `processed_at`, `status`, `retry_count`, `provider`, `event_time_ms`. **This is the best available signal for delivery-gap detection** — see [the DB audit query](#primary-audit-query-the-internal-webhook_events-ledger). |
| Self-heal net | Daily cron `0 2 * * *` → `reconcileStripeSubscriptions()` (`apps/web/app/api/cron/reconcile-stripe/route.ts`). **Has holes** — see [reconcile gap analysis](#does-the-reconcile-cron-save-us-partly). |

---

## Load-bearing claim verified: Attack Mode vs bypass rules

The synthesis's keystone claim — *"Vercel Attack Mode overrides bypass rules, so a path-scoped `/api/v1/*` bypass under challenge is impossible"* — traced to a June-2024 community post and needed re-checking against current docs. **Checked 2026-07-22 against `vercel.com/docs/vercel-firewall/attack-mode` (updated 2026-05-08) and `.../firewall-concepts` (updated 2026-06-16).**

**Verdict: CONFIRMED, with two important refinements.**

1. **CONFIRMED — you cannot exempt paths from Attack Mode with a custom bypass rule.** Vercel's evaluation order is: platform-wide firewall / system mitigations (at the CDN) → deployment protection → WAF custom rules. Attack Mode is a *system-layer* mitigation applied **before** custom WAF rules. A custom **bypass** action only "allows the request through any custom or managed rules" — it does not skip system-level mitigations (only a *system* bypass does that). So the naive "tunnel `/api/v1` under Attack Mode via a path bypass" is not viable. The synthesis's routing decision (grey-cloud `api.` host + remove/replace the account-wide challenge) stands.

2. **REFINEMENT A — the correct granular tool is a host-scoped custom WAF *challenge* rule, not a bypass.** The docs explicitly say: *"If you need more control over what traffic is challenged, consider using Custom Rules with the Vercel WAF."* This is exactly the "host-scoped challenge rule for `handicappin.com` prepared as instant rollback" the synthesis prescribes. Good — the rollback control is real and documented.

3. **REFINEMENT B (materially changes the webhook-damage hypothesis) — Attack Mode auto-allows verified webhook providers AND internal requests.** Direct quotes:
   - *"known bots (like search engines and **webhook providers**) are automatically allowed through."*
   - *"When Attack Mode is enabled, requests from your own **Functions and Cron Jobs** are automatically allowed through without being challenged."*

   **Implication:** *If* the mitigation in effect is the account-wide **Attack Mode** toggle specifically, then (a) Stripe/RevenueCat deliveries may **not** have been blocked at all — they can be in Vercel's verified-provider directory — and (b) the reconcile **cron** was NOT challenged, so the self-heal net stayed up. What is *definitely* broken under Attack Mode is **non-recognized automated traffic**: the native app's Bearer requests, direct API/cURL, Postman. The docs say so directly: *"Standalone APIs, other backend frameworks, and non-recognized automated services may not be able to pass challenges and could be blocked."*

   **BUT this auto-allow only applies to the Attack Mode feature.** If the mitigation is instead a **manually-added custom challenge rule**, or Vercel's **automatic** DDoS mitigation aggravated by Cloudflare-IP concentration, the verified-provider auto-allow does **not** apply and webhooks *could* have been dropped. **The `x-vercel-mitigated: challenge` header alone cannot distinguish these three cases.** This is why Step 0 (identify *which* mitigation) is now doubly load-bearing: it also tells you whether the webhook audit is a formality or a real cleanup.

Sources:
- https://vercel.com/docs/vercel-firewall/attack-mode
- https://vercel.com/docs/vercel-firewall/firewall-concepts
- https://vercel.com/docs/vercel-firewall/vercel-waf/custom-rules
- https://vercel.com/changelog/rate-limiting-now-available-on-hobby-with-higher-included-usage-on-pro

---

## The fix, resequenced (from synthesis)

### Step 0 — three 5-minute checks BEFORE touching anything
These are dashboard-only and belong to Sebastian. See the [checklist](#sebastian-must-do-in-dashboard). Do not change the firewall until these three questions are answered:
1. Which mitigation is actually on (Attack Mode toggle vs custom challenge rule vs automatic mitigation)?
2. What is the plan tier and the WAF rule budget?
3. Why is Cloudflare orange-clouding the zone, and was there a real attack?

### Step 1 — ship the tripwire BEFORE changing the firewall
Done in prep (not yet committed): `.github/workflows/ingress-canary.yml`. It probes `handicappin.com/api/trpc/course.getCourseById` cookie-less from a GitHub runner (outside Vercel's account boundary, so it is treated as a real external client) every 15 min + on demand, and fails loudly on `x-vercel-mitigated: challenge`, HTTP 429/403, or an HTML body where JSON was expected. **Merge/enable this and confirm it goes green/red correctly BEFORE any firewall change**, so you can watch the fix land and catch a regression (someone re-toggling the challenge) within ~15 minutes.
- The brief named `course.getAll`; that procedure does not exist — the canary uses `course.getCourseById` (a real public procedure). Substitution noted in the workflow.
- Alerting (Slack/email) is stubbed at the bottom of the workflow — wire it once the fix is live.

### Step 2 — unblock ingress
Based on Step 0's finding: turn Attack Mode off, OR edit the offending custom rule, OR grey-cloud — **with a host-scoped challenge rule for `handicappin.com` prepared as instant rollback** (non-optional until "was there a real attack?" is answered). This repairs the native app's Bearer path and the mid-round 1-hour-expiry browser failures. Incident fix — do not wait on the fitness-app work.

### Step 3 — audit Stripe/RevenueCat webhook delivery for the challenge window
See [Webhook delivery audit](#webhook-delivery-audit). Do this while replay windows are open (Stripe retries ~3 days; RevenueCat retries too but the dashboard history is the durable record).

### Step 4 — create `api.handicappin.com` as a HARD GATE
Grey-clouded (DNS-only) Cloudflare CNAME → same Vercel project. The native/fitbull integration must be pinned to `api.handicappin.com` from its first commit, never `handicappin.com`, or API availability is permanently re-coupled to the marketing site's edge posture. Grey-clouding also fixes the latent `getIdentifier()` bug (`apps/web/lib/rate-limit.ts:188-207` prefers `x-real-ip`, which behind orange-cloud is a Cloudflare edge IP — all anonymous traffic shares a handful of rate buckets).

### Step 5 — the replacement abuse layer, right-sized
Bearer/API-key auth (401 junk) + Upstash per-identity sliding windows (`apps/web/lib/rate-limit.ts`) + **one** Vercel WAF rate-limit rule as a 429 backstop + **Vercel spend limits/alerts** (the challenge was a free denial-of-wallet shield; its replacement must include billing controls). Two required hardening fixes on the Upstash layer: it currently **fails open** at every level (unset `RATE_LIMIT_ENABLED`, missing KV creds, Redis init error all silently allow) — make it fail-closed or at minimum Sentry-alerting for the public API path, and assert the env at startup. **Skip** IP/JA4 WAF tuning until a genuine third party exists.

### Step 6 — hardening & documentation
Treat the `proxy.ts` host guard as a security boundary with negative tests (absent/wrong/ported Host headers). Decide the CORS posture for the api host. Encode the runbook rule: **never use the account-wide Attack Mode toggle for routine mitigation — use a host-scoped custom challenge rule** so `api.` stays unchallenged. Optionally make the ruleset declarative via Vercel's REST API / Terraform.

---

## SEBASTIAN MUST DO IN DASHBOARD

Nothing below can be done from the CLI read-only. Do Step 0 first; do not change the firewall before the canary (Step 1) is live.

**Vercel → project `handicappin` → Firewall:**
- [ ] **Identify the active mitigation.** Bot Management tab: is **Attack Mode** toggled on? Firewall/Custom Rules tab: is there a manually-added **challenge** rule? Monitoring tab: is there **automatic** mitigation firing? Record which one — it determines whether the fix is toggle-off, rule-edit, or grey-cloud-first, AND whether webhooks were auto-allowed (Attack Mode) or possibly dropped (custom rule / automatic).
- [ ] **Read the plan tier** (Settings/Billing) and the **WAF rule budget**. Hobby = 3 custom rules + 1 rate-limit rule total. Confirm headroom before designing the replacement ruleset. If on Hobby with the budget nearly consumed, note it — it constrains Step 5.
- [ ] **Check Firewall → Monitoring / traffic history:** was there an actual attack (traffic spike, a JA4/IP concentration) that justified the challenge, or was it a panic toggle / a zone-add side effect? If no real attack, the host-scoped rollback rule can be relaxed sooner.
- [ ] **Check Cron execution logs** for `/api/cron/reconcile-stripe` during 2026-07-08 → now. If those runs 401'd or never fired, the self-heal net was down and the webhook audit is not optional. (Under Attack Mode specifically, crons are auto-allowed and should have run — confirm.)
- [ ] **Prepare (do not yet apply) the rollback rule:** a host-scoped custom **challenge** rule matching `Host = handicappin.com` so you can re-arm the challenge in one click if an attack resumes after you disable Attack Mode.

**Cloudflare → zone `handicappin.com`:**
- [ ] **Determine why the zone is orange-clouded.** Are there page rules, redirects, WAF, or origin-hiding that depend on proxying? If orange-cloud is just a zone-add default with no dependency, plan to **grey-cloud broadly** — it simplifies the whole topology and restores real client IPs to Vercel (fixing the rate-limit bucketing bug and enabling Vercel's automatic DDoS which only works once it sees real IPs).
- [ ] **Create the grey-clouded (DNS-only) `api.handicappin.com` CNAME → Vercel** (Step 4). This is fitbull's base URL from commit one.

**Stripe (live dashboard — the CLI can't reach the live account):**
- [ ] See [Webhook delivery audit](#webhook-delivery-audit) — Sebastian must do this in the live dashboard or re-login the CLI.

---

## Webhook delivery audit

The CLI could only reach the **sandbox** account (clean — nothing lost). The **live** account (`acct_1S0pJ5Lk50S7inDF`) is where real damage would be, and its CLI key **expired 2026-07-09**, so it must be audited by one of:

**Option 1 — Stripe live dashboard (fastest, authoritative).**
1. Dashboard → Developers → **Webhooks** → select the live endpoint (should point at `https://handicappin.com/api/stripe/webhook`).
2. Open **"Failed" / recent deliveries**. Filter to 2026-07-08 → now (bound the window once Step 0 tells you when the challenge started).
3. For any delivery that returned a **429 / HTML** (challenge page) instead of 2xx: note the **event ID** and **event type**. These are replayable — click **Resend**, or replay in bulk via the CLI once re-authed.
4. Record whether Stripe's automatic retries eventually succeeded (they retry ~3 days). Events past the retry window that never succeeded are the permanent losses.

**Option 2 — re-auth the CLI, then query the live account.**
```
stripe login                       # interactive; run yourself via `! stripe login`
stripe webhook_endpoints list --live
stripe events list --live --limit 100        # inspect pending_webhooks per event
# Replay a specific dropped event:
stripe events resend <evt_id> --live
```

### PRIMARY audit query: the internal `webhook_events` ledger
Independent of Stripe's own logs, the app writes every **processed** event to `webhook_events`. A **gap** in `processed_at` during the challenge window = deliveries that never landed. Run against **production** DB (read-only; use the session pooler per prior deploy notes — direct IPv6 fails):

```sql
-- Last success before the window and event volume per hour around the incident.
SELECT date_trunc('hour', processed_at) AS hr,
       provider, event_type, status, count(*)
FROM webhook_events
WHERE processed_at >= '2026-07-06'
GROUP BY 1,2,3,4
ORDER BY 1;

-- Any failed rows (the handler recorded a failure) in the window:
SELECT event_id, provider, event_type, processed_at, retry_count, error_message
FROM webhook_events
WHERE status = 'failed' AND processed_at >= '2026-07-06'
ORDER BY processed_at;
```
A cleanly-delivered period shows a steady hourly cadence; a challenge-induced outage shows a **flat gap** (Stripe couldn't reach the handler, so no row was written at all — the absence is the signal, which is why you cross-reference against the Stripe dashboard's delivery list, not just this table).

### RevenueCat (no CLI — manual only)
1. RevenueCat dashboard → **Project → Integrations → Webhooks** (or Project Settings → Webhooks).
2. Open the webhook pointing at `https://handicappin.com/api/webhooks/revenuecat` → **Delivery history / logs**.
3. Filter to the challenge window. Look for deliveries with **non-2xx** responses (429 / HTML challenge). RevenueCat retries with backoff; note any that exhausted retries.
4. RevenueCat exposes **"Resend"** per event in the delivery log — replay any that failed. If bulk replay isn't available in the UI, RC support can re-drive a window.
5. Cross-check against `webhook_events WHERE provider = 'revenuecat'` for the same gap.

### Does the reconcile cron save us? Partly.
`reconcileStripeSubscriptions()` (`apps/web/lib/reconciliation/stripe-reconciliation.ts`) runs daily and heals subscription drift — but it has holes that the webhook audit must cover manually:
- **It only scans users already marked paid** (`planSelected` not free/null). A `checkout.session.completed` dropped during the window leaves a paying customer stuck on `free` in the DB — and reconcile **never looks at free users**, so it will not self-heal. These are the highest-severity losses: money taken, product not delivered, invisible to the safety net.
- **Lifetime / one-time payments are not verified** (explicit `TODO` — "Verify lifetime payment exists in Stripe charges (future enhancement)").
- **Refunds, disputes, invoice events are not reconciled** at all.
- Subscription *status changes* for already-paid users DO self-heal daily.

So the audit's priority order: (1) new checkouts (free→paid) in the window, (2) lifetime purchases, (3) refunds/disputes, (4) subscription status changes (lowest — reconcile covers these).

---

## Rollback plan

- **Before disabling the challenge:** the canary (Step 1) is live and green-on-healthy, and the host-scoped challenge rule for `Host = handicappin.com` is authored and staged (not applied).
- **If an attack resumes** after you disable Attack Mode: apply the staged host-scoped challenge rule (one click) — this re-challenges `handicappin.com` only, leaving `api.handicappin.com` (grey-clouded, Bearer + Upstash protected) serving the native app and fitbull. This is the runbook's standing rule: **re-arm via the host-scoped rule, never the account-wide Attack Mode toggle.**
- **If grey-clouding `api.` breaks something** (unexpected Cloudflare dependency): revert the CNAME to orange-cloud; the API host falls back to the same edge posture as the main host (degraded but functional for browser-session traffic). Track this as the known shared-edge risk until a real third party forces full isolation.
- **If the canary goes red after the fix:** the challenge regressed (someone re-toggled Attack Mode, or automatic mitigation re-fired). Check Firewall → Monitoring for a fresh attack before assuming a mistake — a signal that pattern-matches the incident may have a new cause.

---

## ADDENDUM 2026-07-22 — mitigation identified, Stripe live audit complete

**Step 0 answered: the active mitigation is the Bot Protection managed ruleset set to Challenge** (Vercel → Bot Management tab). Not Attack Mode, not a custom rule. This changes the analysis (checked against `vercel.com/docs/bot-management`, updated 2026-07-09):

- Bot Protection challenges **non-browser traffic** ("prevents requests that falsely claim to be from a browser such as a curl request identifying as Chrome") — fully explains the native app + cURL 429s.
- **Verified bots are auto-excluded** — same as Attack Mode; Stripe deliveries were probably allowed *when recognized*.
- **Custom WAF bypass rules DO work against Bot Protection** (docs: "For trusted automated traffic, you can create custom WAF rules with bypass actions that will allow this traffic to skip the bot protection ruleset"). The "bypass is impossible" finding was Attack-Mode-specific and does NOT apply to the actual mitigation. A path/host-scoped bypass is a legitimate tool here.
- **Decisive:** the docs explicitly state Bot Protection **doesn't work behind a reverse proxy (Cloudflare named)** — masked detection signals wrongly challenge legitimate users, and proxy IP rotation forces re-challenges. The current orange-cloud + Bot Protection combination is documented-broken. This both explains intermittent behavior and strengthens the grey-cloud plan.
- **Revised incident fix:** flip Bot Protection **Challenge → Log** (Bot Management tab, instantly reversible — Log keeps observability). Rollback = flip back to Challenge. The staged host-scoped challenge rule from Step 2 remains the finer-grained fallback if abuse resumes.

**Stripe LIVE audit (CLI re-authed 2026-07-22):** 16 events total 2026-06-22 → 2026-07-15. **No checkout/subscription/payment events occurred in the window — no revenue events were lost.** 4 × `customer.created` never delivered (pending_webhooks=1, past the ~3-day retry window — permanent unless resent): `evt_1TlWkULk50S7inDFdlPqogvL` (06-23), `evt_1Tlr56Lk50S7inDFmRaBdrKJ` (06-24), `evt_1To6c5Lk50S7inDFCqitittr` (06-30), `evt_1TpBRxLk50S7inDFkSreEerO` (07-03). Impact assessed as ~nil: the checkout API path writes the same `stripe_customers` mapping race-tolerantly and the handler is idempotent (`onConflictDoNothing`) — but resend all 4 after the fix anyway: `stripe events resend <evt_id> --live`. Failures interleaved with successes (11 delivered in the same period) → intermittent challenge, consistent with the reverse-proxy re-challenge behavior above; challenge active since at least 2026-06-23. Note: the live webhook endpoint URL carries a `x-vercel-protection-bypass` query param (Protection Bypass for Automation — bypasses *deployment protection*, evidently not reliably the WAF challenge).

**Still open:** RevenueCat dashboard delivery history (manual); `webhook_events` ledger corroboration + round-count distribution (Supabase SQL editor); plan tier + WAF rule budget (Vercel Settings→Billing); reconcile-cron execution logs.

## Carried-forward dissent (do not lose)

Option B's isolation is **edge-only**: `api.` and the web/native product share one Vercel project — function concurrency, quotas, billing, deploys. An API-host flood or a fitbull retry loop degrades the paying product. And shipped native binaries pin `handicappin.com`, so the main host's edge posture stays load-bearing until a forced-upgrade mechanism exists. Neither flips the decision, but the shared-project blast radius is the first thing to revisit if a real third-party consumer appears.

## ADDENDUM 2026-07-27 — W0 repo hardening landed (subplan 001)

Shipped on branch `api-platform/001-ingress-completion`:

- **Upstash layer fail-closed** (`apps/web/lib/rate-limit.ts`): the public API
  surface (`/api/v1` paths, `api.handicappin.com` host) now DENIES via
  `enforcePublicApiRateLimit()` when `RATE_LIMIT_ENABLED` is unset, KV creds
  are missing, or Redis init/requests throw — every fail-closed denial is
  Sentry-alerted (`rate-limit-fail-closed`). First-party endpoints keep
  fail-open, now Sentry-alerted at init (`rate-limit-unavailable`).
- **Env asserted at startup** (`apps/web/env.ts`): production deploys fail
  loudly unless `RATE_LIMIT_ENABLED` is explicitly `true`/`false`.
  ⚠ Set it in Vercel production env BEFORE merging/deploying.
- **`getIdentifier()` bucketing bug fixed** (Step 4 note above): trust order
  is now `cf-connecting-ip` → `x-real-ip` → last `x-forwarded-for` hop, so
  orange-cloud traffic no longer collapses into Cloudflare edge-IP buckets.
- **Middleware host guard** (`apps/web/proxy.ts` + `apps/web/lib/host-guard.ts`):
  absent/wrong/ported Host headers get a 400 before any session work, with
  negative tests (Step 6).
- **Canary alerting wired** (`.github/workflows/ingress-canary.yml`): Slack
  paging activates once the `SLACK_WEBHOOK_URL` repo secret is set (owner).
- **Standing state + rollback rule committed**: `docs/ingress-firewall-state.md`
  records the dashboard state (Bot Protection = Log, staged host-scoped
  challenge rule for `Host = handicappin.com`), the CORS posture for the api
  host, and the standing rule — **never re-arm via an account-wide toggle;
  always the host-scoped rule** — plus the open owner checklist.

Open owner items are tracked in `docs/ingress-firewall-state.md` (grey-cloud
CNAME, spend alerts, WAF rate rule, staged rollback rule, Slack secret,
`RATE_LIMIT_ENABLED` in Vercel, RevenueCat check + Stripe resends).
