# PostHog Self-driving Setup Report

_Generated 2026-07-13 by the Self-driving setup wizard_

## Summary

PostHog Self-driving has been configured for the Handicappin project. Signal sources for error tracking, session replay, support/conversations, and GitHub Issues are now active; the scout troop is tuned with three scouts (general, product-analytics, revenue-analytics) plus one custom scout watching the core round-submission pipeline. Findings will start appearing in the Self-driving inbox within ~30 minutes: https://eu.posthog.com/project/101298/inbox

---

## AI data processing

**Status:** Approved. Organization-level AI data processing consent was verified by the wizard before this run started.

---

## GitHub

| Item | Status |
|---|---|
| GitHub App integration | Connected during this run — Sebastian-Sole (integration id: 70666) |
| Repos granted | All repos the user approved during the App install flow |

---

## Products enabled

`products-enable` is not available in the current PostHog MCP version. The three products below need to be toggled on manually from PostHog project settings. The `posthog.init` override for Session Replay was already corrected in code (see below).

| Product | Status | Notes |
|---|---|---|
| Session Replay | **Manual follow-up required** | Enable in PostHog → Project Settings → Session Replay. The `disable_session_recording: true` override in `apps/web/lib/analytics.ts` has been removed so the server toggle will take effect immediately once enabled. |
| Error Tracking | **Manual follow-up required** | Enable in PostHog → Project Settings → Error Tracking. No `capture_exceptions: false` override found in `posthog.init` — the server toggle is enough for web. |
| Support (Conversations) | **Manual follow-up required** | Enable in PostHog → Project Settings → Conversations. Tickets only arrive once an inbound channel (email / inbox / Slack) is connected — see follow-ups. |
| Native (Expo / RN) replay | **Not applicable** | `apps/native/lib/analytics.ts` uses `posthog-react-native` with no session recording config. The server flip is inert for mobile — see follow-ups if mobile replay is wanted. |

**`posthog.init` edit made:** Removed `disable_session_recording: true` from `apps/web/lib/analytics.ts` line 40. No other init options were changed.

---

## Signal sources

| source_product | source_type | Action |
|---|---|---|
| `error_tracking` | `issue_created` | **Enabled** (id: `019f5bcf-ae87-76ce-ad50-ab719d2181d0`) |
| `error_tracking` | `issue_reopened` | **Enabled** (id: `019f5bcf-b171-7753-af19-1dc30ebfeb15`) |
| `error_tracking` | `issue_spiking` | **Enabled** (id: `019f5bcf-b54f-7cb6-b9fa-ac8d9aa9746a`) |
| `session_replay` | `session_analysis_cluster` | **Enabled** (id: `019f5bcf-bc4c-7ad7-847d-7254770e3440`, sample_rate: 0.1) |
| `conversations` | `ticket` | **Enabled** (id: `019f5bcf-beaf-7523-94ea-1ae50abd8fcf`) |
| `signals_scout` | `cross_source_issue` | **Skipped** — ON by default; creating a row would opt out |
| `llm_analytics` | — | **Skipped** — not a v1 responder |
| `logs` | — | **Skipped** — not a v1 responder |

---

## Connected tools

| Tool | Status |
|---|---|
| GitHub Issues | **Connected by this setup** — warehouse source id `019f5bd2-d58c-0000-dac5-76343cdd257a`, syncing the `issues` table incrementally on `updated_at`. First sync started automatically. Responder id: `019f5bd2-eb60-79cc-ae2e-f4ddf3b52258`. Additional tables (pull requests, etc.) can be enabled in PostHog → Data Warehouse. |
| Linear | Not used (not picked) |
| Zendesk | Not used (not picked) |
| pganalyze | Not used (not picked) |

---

## Scout troop

**4 scouts active** out of 27 total.

### Enabled

| Scout | Reason |
|---|---|
| `signals-scout-general` | Always on — cross-product correlations and surfaces no specialist covers |
| `signals-scout-product-analytics` | Primary product surface: rich round/paywall/stats event taxonomy |
| `signals-scout-revenue-analytics` | Stripe + RevenueCat billing events are heavily instrumented server-side |
| `signals-scout-round-submission` | Custom scout (see below) |

### Disabled

| Scout | Reason |
|---|---|
| `signals-scout-error-tracking` | Covered by native `error_tracking` signal sources (issue_created / issue_reopened / issue_spiking) |
| `signals-scout-session-replay` | Covered by native `session_replay` signal source (session_analysis_cluster) |
| `signals-scout-feature-flags` | No feature flags found in use in the codebase |
| `signals-scout-surveys` | No surveys in use (0 surveys) |
| `signals-scout-ai-observability` | `openai` SDK present but no `$ai_*` events instrumented |
| `signals-scout-web-analytics` | Autocapture and pageview tracking deliberately disabled in `posthog.init` |
| `signals-scout-web-vitals` | No `$web_vitals` events — autocapture disabled |
| `signals-scout-experiments` | No active A/B experiments |
| `signals-scout-apm` | No distributed tracing / OpenTelemetry configured |
| `signals-scout-csp-violations` | No CSP reporting configured |
| `signals-scout-customer-analytics` | No group / B2B account analytics |
| `signals-scout-data-pipelines` | No CDP destinations or hog flows |
| `signals-scout-data-warehouse` | GitHub Issues is the only warehouse source; not the primary focus |
| `signals-scout-logs` | PostHog logs product not in use |
| `signals-scout-replay-vision` | No Replay Vision scanners configured |
| `signals-scout-anomaly-detection` | Not in the top-2 specialists |
| `signals-scout-health-checks` | Not in the top-2 specialists |
| `signals-scout-inbox-validation` | Fresh setup — no resolved reports to validate yet |
| `signals-scout-ingestion-warnings` | Not in the top-2 specialists |
| `signals-scout-insight-alerts` | Not in the top-2 specialists |
| `signals-scout-mcp-tool-calls` | Not relevant to the Handicappin product |
| `signals-scout-observability-gaps` | Not in the top-2 specialists |
| `signals-scout-skills-store` | Not in the top-2 specialists |

Re-enable any of these in PostHog → Self-driving → Scouts if the relevant product surface comes online later.

---

## Custom scouts

### Created: `signals-scout-round-submission`

**What it watches:** The golf round submission pipeline — `round_add_started` → `round_submitted` (manual path) and `live_round_started` → `live_round_submitted` (live path).

**Discriminator:** Completion rate in the last full day vs the 7-day rolling median. A drop of >15 percentage points triggers investigation. Secondary: `approval_status` distribution shift (>20pp toward non-auto-approved), and a spike in `round_submitted` events where `score_differential` is null (scoring engine failure).

**Why no built-in covers it:** `signals-scout-product-analytics` only watches *saved* PostHog funnels/insights — on a fresh project with none built yet, it has nothing to scan. The domain-specific attributes (`approval_status`, `score_differential`, live-vs-manual split) are not interrogated by any built-in specialist.

**Considered and ruled out:**
- _Billing conversion funnel_ (`paywall_viewed` → `upgrade_clicked` → `checkout_initiated` → `subscription_started`): Watchable but ruled out by overlap with `signals-scout-revenue-analytics`, which already watches Stripe capture regressions and goal-miss escalations.

**Noise escape hatch:** If this scout turns out noisy, set `emit: false` on its config in PostHog → Self-driving → Scouts to switch it to dry-run mode (it still runs but writes nothing to the inbox).

---

## Follow-ups

- [ ] **Enable Session Replay** in PostHog → Project Settings → Session Replay. The `posthog.init` override has already been removed — only the server toggle remains.
- [ ] **Enable Error Tracking** in PostHog → Project Settings → Error Tracking.
- [ ] **Enable Support (Conversations)** in PostHog → Project Settings → Conversations.
- [ ] **Connect a Conversations inbound channel** (email, inbox, or Slack) in PostHog after enabling Support — tickets only flow into the inbox once a channel exists.
- [ ] **Mobile session replay (optional):** If you want session recordings from the native Expo app, add `enableSessionReplay: true` to the `posthog-react-native` config in `apps/native/lib/analytics.ts`.
- [ ] **Native exception capture (optional):** Add `enableExceptionAutocapture: true` to the `posthog-react-native` config in `apps/native/lib/analytics.ts` if you want PostHog error tracking on mobile in addition to Sentry.
- [ ] **Build product funnels in PostHog** (paywall → upgrade → checkout → subscription, round add → submission) so `signals-scout-product-analytics` has saved insights to watch.
- [ ] **Additional GitHub Issues tables:** Only `issues` is syncing from `Sebastian-Sole/handicappin`. Enable pull_requests, commits, or other tables from PostHog → Data Management → Sources if wanted.

---

## What happens next

The scout coordinator picks up fresh configs within ~30 minutes and fires the first run of each enabled scout. Findings cluster into reports in the inbox. Reports that are immediately actionable will suggest code fixes Self-driving can open as a PR against `Sebastian-Sole/handicappin`.

Inbox: https://eu.posthog.com/project/101298/inbox
