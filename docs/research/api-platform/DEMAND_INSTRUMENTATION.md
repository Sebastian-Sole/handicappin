# Demand Instrumentation Spec — API-access interest (ships WITH v1)

**Date:** 2026-07-29 · **Workstream:** W7 (subplan `plans/008-w7-launch-gates.md`) · **Status:** SPEC — not yet implemented
**Binding source:** golf-api-landscape synthesis conditions C.12 + C.13; DECISIONS §8 ("demand instrumentation (API-interest form + PostHog event) ships with v1").

Why this exists: two of the three phase-2 triggers in the platform-deferral ADR are **passive** — "a named partner asks" and "the user base is large enough" will never fire on their own for a deliberately unpublicized API. Without measurement, "defer until trigger" silently becomes "never". This spec is the falsifier. It is a **spec only**; implementation lands with the v1 surface (005/006 timeframe), not in this PR.

---

## 1. What must be measurable on day one

| Question the owner must be able to answer in October 2026 | Signal |
|---|---|
| Did anyone ask for API access at all? | count of `api_access_interest_submitted` |
| Who, and can we contact them? | the interest record row (email + free-text), not PostHog |
| Was it a real product with users, or a hobbyist? | `has_users` + `use_case` on the event; details in the record |
| Did they want to read the index or write rounds? | `direction` property |
| Is fitbull actually using the surface (baseline for "is this worth keeping")? | `api_round_submitted` / per-consumer request counts |
| Where did the interest come from? | `source` property |

Two independent things get instrumented: **(A) inbound third-party demand** (the trigger falsifier) and **(B) first-party usage of the surface we did build** (so the October review can also answer "is /v1 earning its keep?").

## 2. Repo conventions this must follow

Non-negotiable, from `packages/analytics/src/events.ts` and the existing call sites:

- Every event is declared in `AnalyticsEventMap` in `packages/analytics/src/events.ts` **first**, with a typed payload, plus a constant in `ANALYTICS_EVENTS`. No `capture("string_literal")` at call sites; reviewers reject them.
- Naming: `snake_case`, **past-tense verb, object first** (`api_access_interest_submitted`, not `submit_api_interest`).
- **One side owns each event.** Server-captured events (webhooks / tRPC procedures / route handlers) use `getPostHogClient()` from `@/lib/posthog` and must not be duplicated client-side; UI-truth events go through the `analytics` singleton in `@/lib/analytics`.
- **PII rule (hard):** `distinctId` is the Supabase user id; for unauthenticated capture the existing precedent is the rate-limit identifier (`contact.ts` uses the raw IP as `distinctId`). **Never** put email, name, or free-text that could contain them into properties. The interest form's email lives in the DB record and in the notification email — never in a PostHog property.
- Server capture in a request-scoped handler ends with `await posthog.flush()` (serverless: the client is configured `flushAt: 1, flushInterval: 0`, but the existing sites still flush explicitly — match that).
- Fail-open: analytics must never break the request. No token → no-op client; that is already the case in both `lib/posthog.ts` and `lib/analytics.ts`.

## 3. Events to add

Add all of these to `packages/analytics/src/events.ts` (one edit, `AnalyticsEventMap` + `ANALYTICS_EVENTS`), grouped under a new `// --- api platform ---` comment block.

### 3.1 `api_access_interest_viewed` — client (UI truth)

```ts
/** The API-access interest form was seen (impression denominator). */
api_access_interest_viewed: { source: ApiInterestSource };
```

Fires from the form component on mount, via `analytics.capture("api_access_interest_viewed", { source })`. Purpose: a submit count without an impression count cannot distinguish "nobody wants it" from "nobody found it" — the single most likely way this instrumentation lies to the October review.

### 3.2 `api_access_interest_submitted` — server (tRPC procedure)

```ts
/** server: apps/web/server/api/routers/api-interest.ts */
api_access_interest_submitted: {
  source: ApiInterestSource;
  direction: "read" | "write" | "both";
  /** Self-reported: does the asker's product already have users? */
  has_users: boolean;
  /** Coarse self-reported bucket — NEVER free text. */
  use_case: ApiInterestUseCase;
  /** True when the submitter is signed in (a user, not a stranger). */
  is_authenticated: boolean;
};
```

Captured server-side in the mutation, mirroring `contact.ts` exactly (rate limit → side effects → `posthog.capture` → `await posthog.flush()`). Server-side because it is a conversion fact that must survive ad-blockers and because the mutation is where dedupe/rate limiting lives.

Supporting types, also in `events.ts`:

```ts
export type ApiInterestSource =
  | "docs_stub"        // the internal/unstable contract page, if ever linked
  | "settings"         // account → integrations/connected apps
  | "contact_page"     // an "API access" subject option on the contact form
  | "footer"
  | "direct_link";     // shared URL, e.g. pasted in an email reply

export type ApiInterestUseCase =
  | "personal_project"
  | "existing_app"     // a shipping product with users
  | "club_or_federation"
  | "coaching_or_analytics"
  | "other";
```

`use_case` is a closed union precisely so the *analysable* field is PII-free; the free-text description goes to the DB record and the notification email only.

### 3.3 `api_round_submitted` — server (usage baseline, /v1)

```ts
/** server: apps/web/app/api/v1/rounds/route.ts */
api_round_submitted: {
  /** OAuth client_id of the calling consumer — attribution, not identity. */
  consumer: string;
  quarantined: boolean;
  holes_played: number;
};
```

Ownership note: `round_submitted` already fires inside the shared submission service; this event is the **API-transport** fact, not a second round event. Whichever way 005 wires it, the rule is: exactly one `round_submitted` per round, and `api_round_submitted` only for `/v1`-originated writes. If 005 instead adds a `submitted_via` property to `round_submitted` (the `submitted_via` column is already in 003's migration bundle), that satisfies this requirement and `api_round_submitted` should be dropped rather than duplicated — decide it in 005, record the choice here.

> **Decision recorded (T12, 2026-08-05): keep `api_round_submitted` as its own event** (D9 locked it by name; the `submitted_via`-breakdown alternative is not taken). The event is in the taxonomy and its capture helper `captureApiRoundSubmitted` lives in `apps/web/lib/api-platform/analytics.ts` — the shared service cannot emit it because `consumer` (the OAuth client_id) exists only at the `/v1` transport layer. The wave-2 route task (010 T13) owes exactly one line in `apps/web/app/api/v1/rounds/route.ts` after a successful write: `await captureApiRoundSubmitted({ userId, consumer: clientId, quarantined, holesPlayed })`. A unit test (`tests/unit/analytics/api-platform-events.test.ts`) guards that nothing under `apps/web/server/` — the web/native path — ever references the event.

### 3.4 `api_connect_completed` — server (funnel, optional-but-cheap)

```ts
/** server: the OAuth consent handler (004). */
api_connect_completed: { consumer: string };
```

Only meaningful once the Connect flow exists (004). Included because "how many users connected fitbull" is the other half of the October question and it is one line at a handler that already exists.

> **Implemented (T12, 2026-08-05), with one placement nuance:** the 004 consent approval is a browser → GoTrue hop (`supabase.auth.oauth.approveAuthorization` in the consent card) — there is no first-party server handler on that hop. The event is therefore captured by the tRPC mutation `oauth.connectCompleted` (`apps/web/server/api/routers/oauth.ts`), which the consent card calls after a successful approval and which **re-verifies the grant against GoTrue (`listGrants`) before capturing** — the event stays a server-verified fact, not a client-reported claim. `consumer` is the GoTrue OAuth client id; `distinctId` is the Supabase user id.

## 4. The interest form (surface)

Minimal, deliberately unglamorous — this is a measuring instrument, not a developer portal, and building anything portal-shaped would violate DECISIONS §8.

- **Route:** `apps/web/app/api-access/page.tsx` (server component) + a small `"use client"` form. Route name kept boring on purpose; no nav link required at launch (a `settings`/`contact_page` entry point is enough — but see §3.1: if nothing links to it, the impression count is the honest answer).
- **Form fields:** email (required), what you're building (free text), `direction` (read/write/both), `use_case` (select), `has_users` (checkbox). react-hook-form + `@hookform/resolvers/zod`, schema shared with the server per repo conventions.
- **Mutation:** tRPC, `apps/web/server/api/routers/api-interest.ts`, `publicProcedure` (a stranger with a product is exactly the trigger-2 case). Rate limit with a new `apiInterestRateLimit` in `@/lib/rate-limit`, identifier `ip:<ip>` (contact-form pattern; the public endpoint rule in the coding conventions makes this mandatory).
- **Persistence:** an `api_access_interest` table (id, created_at, email, description, direction, use_case, has_users, user_id nullable) — the contact record is the thing the owner actually acts on; PostHog is the count. If a table is judged too heavy at implementation time, the acceptable fallback is Resend notification + event only, but then the October review has counts without contacts, which is a worse review.
- **Notification:** reuse the Resend path (`@/lib/email-service`) to email the owner on submit. A trigger nobody notices is not a trigger.
- **Accessibility:** labelled inputs, keyboard-reachable, visible focus — the a11y rules apply as anywhere else.

**Explicitly NOT in scope:** public docs, self-serve keys, sandbox, SDKs, anything that would read as a launched platform (DECISIONS §8, non-goals in 008).

## 5. Dashboard / review artifacts (owner, ~15 min in PostHog)

So the October review is a glance, not an investigation:

1. Insight: `api_access_interest_submitted` weekly count, breakdown by `use_case` and `has_users`.
2. Insight: funnel `api_access_interest_viewed` → `api_access_interest_submitted` (catches the "nobody found it" failure).
3. Insight: `/v1` usage — `api_round_submitted` (or `round_submitted` broken down by `submitted_via`) weekly, plus `api_connect_completed` cumulative.
4. Save all three to a **"API platform"** dashboard; the ADR's review dates reference it by name.

## 6. Verification (008 DoD)

- `pnpm lint` and `pnpm test:unit` pass (the taxonomy addition is type-checked by `satisfies Record<string, AnalyticsEventName>` — a typo in `ANALYTICS_EVENTS` fails the build, which is the intended guard).
- Manual smoke: submit the form on a preview deploy with a real `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN`; confirm `api_access_interest_submitted` lands in PostHog Live Events with the expected properties **and no PII**.
- Unit test on the router: rate limiting returns `TOO_MANY_REQUESTS`; a successful submit calls capture exactly once (mirror the contact-router tests if they exist, otherwise add one small test alongside).

## 7. Gotchas

- **`distinctId` for anonymous submits.** The contact router uses the raw IP as `distinctId`. Follow it for consistency, but note it creates an IP-keyed person profile; if PostHog person volume or privacy posture ever becomes a concern, the fix is a hashed identifier — a deliberate change to make in both places at once, not a silent divergence here.
- **Do not reuse `contact_form_submitted`** with an "API" subject as a shortcut. `subject` is free text; it cannot anchor a trigger threshold, and the October review needs a countable series.
- **The form is not the only inbound channel.** Interest arriving by email or DM never fires the event. The ADR's threshold wording must therefore be about *named askers*, not about the event count alone — the event is the floor, not the ceiling.
- **Client capture is `persistence: "memory"`, `autocapture: false`, no automatic pageviews** (`lib/analytics.ts`). A "page view" of the interest page does not exist unless §3.1 fires it explicitly.

---

**Related:** `GOVERNANCE.md` (the other 008 gate) · `ADR-2026-07-29-launch-gates.md` (thresholds these events feed) · contract source of truth: `plans/005-phase0-contract.md` (owned by 005 Phase 0 — referenced, never duplicated).
