# Plan 004: Throttle the auth surfaces before the App Store launch

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 469a53f..HEAD -- supabase/functions/ apps/web/lib/rate-limit.ts supabase/migrations/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S–M
- **Risk**: LOW–MED (an over-tight throttle locks out legitimate users; an under-tight one is just today's status quo)
- **Depends on**: none
- **Category**: direction (launch hardening; `docs/future-features.md:160-169` gates this on "before public launch" — the App Store submission in `BACKLOG.md` §B makes that condition current)
- **Planned at**: commit `469a53f`, 2026-07-02

## Why this matters

The app is about to get its public launch moment (App Store submission is the current backlog head), and the only unthrottled endpoints in the product are the sensitive ones. The custom OTP-send edge functions — password reset, signup-verification resend, email change — will send an email to any address, any number of times: that is unlimited Resend spend, a harassment vector against arbitrary inboxes, and an account-enumeration aid, all driveable by anyone with the public anon key. Meanwhile `apps/web/lib/rate-limit.ts` already has mature Upstash-based limiters for checkout, portal, contact, AI extraction, and five other surfaces — auth was simply never added, and the OTP-verify function carries a literal `// TODO: Add IP-based rate limiting`. This plan closes the send-side hole with the repo's existing patterns and data, and documents the two owner-side switches (Supabase auth limits, production Redis env) that the code alone can't provide.

## Current state

Files and facts (verified at commit `469a53f`):

- `apps/web/lib/rate-limit.ts:169-177` — nine limiters exist: checkout, portal, webhook, contact, deletion, oauth-callback, google-token, consent, ai-extraction. **None for login, signup, or password reset.** Limits are env-configurable constants (lines 14–22, e.g. `RATE_LIMIT_CONTACT_PER_MIN || '3'`).
- Same file, lines 11 and 60–83: the whole system **fails open** — if `RATE_LIMIT_ENABLED !== 'true'` or Redis creds (`KV_REST_API_URL`/`KV_REST_API_TOKEN`) are absent, every limiter allows everything. Any fix here is a no-op unless production env is set (owner checklist, Step 5).
- `supabase/functions/reset-password/index.ts` — Deno edge function; validates the email, generates an OTP (`_shared/otp-utils.ts`), stores it, and sends via Resend. **No throttle of any kind** (`grep -riE "ratelimit|throttle|429" supabase/functions/reset-password/index.ts` → no hits).
- `supabase/functions/verify-password-reset-otp/index.ts:8-13` — header comments: "Maximum 5 verification attempts per OTP" (enforced at lines 156–172 via `verification_attempts`) and `// TODO: Add IP-based rate limiting (e.g., max 10 attempts per IP per hour)` (line 13). Per-OTP capping exists; per-IP/per-email request capping does not.
- Sibling OTP-send functions with the same shape (verify each before assuming): `supabase/functions/resend-verification-otp/`, `supabase/functions/request-email-change/`, `supabase/functions/send-verification-email/`. Shared helpers live in `supabase/functions/_shared/` (`otp-utils.ts`, `validation.ts`, `cors.ts`).
- The OTP storage table is the unified `otp_verifications` (delivered by the email-deliverability migration — find its schema with `grep -rn "otp_verifications" supabase/migrations/ | head`); each send inserts a row, which means **send-frequency per email is already queryable** — a throttle needs no new infrastructure.
- Login: `apps/web/components/auth/login.tsx:93` calls `supabase.auth.signInWithPassword` directly from the client to Supabase's own auth endpoint. Our Next.js middleware/route layer never sees it, so app-code throttling can't reach it — GoTrue's built-in rate limits (Supabase dashboard → Authentication → Rate Limits) are the control for that path. That is hosted configuration, not code: documented as an owner step here, not "fixed" in this plan.
- Edge functions use Deno with `Deno.env.get(...)`, service-role Supabase client, and `corsHeaders` from `_shared/cors.ts`; JSON error responses with explicit status codes (see the 429 shape at `verify-password-reset-otp/index.ts:156-171` — match it).

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck (web) | `pnpm --filter web exec tsc --noEmit` | exit 0 |
| Lint | `pnpm lint` | exit 0 |
| Unit tests | `pnpm test:unit` | all pass |
| Edge function local serve | `supabase functions serve <name>` | serves on :54321 (needs local stack) |
| Schema sync | `pnpm check:schema-sync` | exit 0 (only if a migration is added) |

## Scope

**In scope**:
- `supabase/functions/_shared/throttle.ts` (create)
- `supabase/functions/reset-password/index.ts`
- `supabase/functions/resend-verification-otp/index.ts`
- `supabase/functions/request-email-change/index.ts`
- `supabase/functions/send-verification-email/index.ts`
- `supabase/functions/verify-password-reset-otp/index.ts` (the line-13 TODO)
- `supabase/migrations/` (only if `otp_verifications` lacks a queryable per-email timestamp — see STOP conditions)
- `docs/billing-runbook.md` is NOT the place; add the owner checklist to `BACKLOG.md` §A-adjacent (Step 5)
- `plans/README.md` (status row)

**Out of scope** (do NOT touch):
- `apps/web/components/auth/login.tsx` and any restructuring of login through a server action — a larger change with UX risk; the owner-side GoTrue limits cover the login path for now (Step 5 documents this decision).
- `apps/web/lib/rate-limit.ts` — the web-side limiter file needs no change for this plan (edge functions can't import it; they get their own shared helper).
- Account-lockout state on `profile` — deliberate deferral; see Maintenance notes.
- Any weakening of the existing per-OTP attempt cap.

## Git workflow

- Branch: `advisor/004-auth-rate-limiting`
- Commit style: conventional commits (e.g. `feat(auth): throttle OTP-send edge functions`).
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Confirm the shape of `otp_verifications` and the sibling functions

Read the `otp_verifications` schema (latest migration defining it) and all four send-side functions. Confirm: (a) each send inserts a row with an email + created-at + type/purpose column; (b) each function extracts the request email before sending. Record the exact column names for Step 2. Confirm each function can see the client IP (`req.headers.get("x-forwarded-for")` — edge functions behind Supabase's gateway receive it; verify by checking whether any existing function reads it).

**Verify**: you can state, with file:line, where each of the four functions inserts its OTP row and reads its input email. (If any function doesn't fit this shape, see STOP conditions.)

### Step 2: Build `_shared/throttle.ts`

One exported function, Deno-style, dependency-free, using the service-role client the functions already construct:

```ts
export async function checkOtpSendAllowed(
  supabase: SupabaseClient,
  opts: { email: string; ip: string | null; purpose: string }
): Promise<{ allowed: boolean; retryAfterSeconds?: number }>
```

Policy (constants at top of file, env-overridable via `Deno.env.get` with these defaults):
- Per email+purpose: max **3** sends per hour (count `otp_verifications` rows for that email/purpose with created-at in the last hour).
- Per IP (when non-null): max **10** sends per hour across all purposes. If `otp_verifications` has no IP column, count against a purpose-agnostic per-email query only and log a structured warning that IP throttling is inactive — do NOT add an IP column to `otp_verifications` without checking STOP conditions.
- On limit: `allowed: false` with `retryAfterSeconds` derived from the oldest counted row.

Fail-**closed is wrong here** (a DB blip would break all password resets): on query error, log and return `allowed: true` — same fail-open philosophy as `apps/web/lib/rate-limit.ts:72-83`, and say so in a comment.

**Verify**: `deno check supabase/functions/_shared/throttle.ts` → exit 0 (run from the repo root; if `deno` isn't installed locally, `supabase functions serve` in Step 4 is the compile check).

### Step 3: Wire the throttle into the four send functions + the verify TODO

In each send function, after email validation and before OTP generation/send: call `checkOtpSendAllowed`; on `allowed: false`, return status **429** with the JSON error shape used at `verify-password-reset-otp/index.ts:156-171` (`error: "Too many requests. Please try again later."`) plus a `Retry-After` header, and — important — **the same response body shape for throttled and successful requests where the function already returns a generic "if the account exists" style message**, so the throttle doesn't become an account-existence oracle. Match each function's existing response envelope.

In `verify-password-reset-otp/index.ts`, resolve the line-13 TODO with the per-IP variant: max 10 verify attempts per IP per hour (count is per-request, so this needs the IP; if IP is unavailable per Step 1, delete the TODO and replace it with a comment stating why, citing this plan).

**Verify**: `supabase functions serve reset-password` locally; POST 4 requests for the same email within a minute → first 3 return the normal response, 4th returns 429 with `Retry-After`. Repeat for one sibling function. (No local stack → STOP condition.)

### Step 4: Tests

Edge functions have no Vitest harness (they're Deno). Add `supabase/functions/_shared/throttle.test.ts` as a Deno test with a stubbed Supabase client (in-memory rows): under-limit allows; at-limit blocks with correct `retryAfterSeconds`; query error allows (fail-open); include a run instruction comment (`deno test supabase/functions/_shared/throttle.test.ts`). If other `_shared` modules already have tests, match their location/style instead.

**Verify**: `deno test supabase/functions/_shared/` → pass (or documented skip if deno is unavailable — then the Step 3 live verification is mandatory, not optional).

### Step 5: Owner checklist (documentation, not code)

Add a short "Auth hardening — owner switches" subsection to `BACKLOG.md` (near the §A owner-work list, matching its tone):
1. Supabase dashboard → Authentication → Rate Limits: confirm/tighten the built-in limits for sign-in attempts and token grants (this is the control for `signInWithPassword`, which client-calls Supabase directly and never traverses app code).
2. Vercel env: confirm `RATE_LIMIT_ENABLED=true` and `KV_REST_API_URL`/`KV_REST_API_TOKEN` are set in production — `apps/web/lib/rate-limit.ts` fails open without them, which silently disables the nine existing web limiters too.
3. Supabase edge-function env: any `RATE_LIMIT_OTP_*` overrides chosen in Step 2.

**Verify**: `grep -n "Rate Limits" BACKLOG.md` → the new subsection exists.

## Test plan

Covered in Steps 3–4: Deno unit tests for the throttle logic (allow/block/fail-open/retry-after), plus a live 4-requests-in-a-row check against the served function. Web-side suites must stay green (`pnpm test:unit`) — they should be untouched by this plan; a failure means you touched something out of scope.

## Done criteria

ALL must hold:

- [ ] All four OTP-send functions call `checkOtpSendAllowed` before sending; `grep -rln "checkOtpSendAllowed" supabase/functions/` lists the 4 functions + `_shared/throttle.ts`
- [ ] `grep -n "TODO: Add IP-based rate limiting" supabase/functions/verify-password-reset-otp/index.ts` returns nothing
- [ ] Live check: 4th same-email request within the hour → HTTP 429 + `Retry-After`
- [ ] Throttled responses don't reveal account existence (same envelope as the function's normal "if the account exists" response)
- [ ] Deno throttle tests pass (or live verification documented if deno unavailable)
- [ ] `pnpm lint`, `pnpm --filter web exec tsc --noEmit`, `pnpm test:unit` all green (no web-side changes)
- [ ] BACKLOG.md owner-switches subsection added
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `otp_verifications` lacks a per-email + created-at queryable shape (the throttle design assumes it) — report the actual schema; adding columns to the OTP table is a migration decision the operator should see.
- Any of the four send functions doesn't insert into `otp_verifications` (e.g. `send-verification-email` predates the unified table) — report which, and wire only the conforming ones.
- No local Supabase stack is available for the Step 3 live check AND deno is unavailable for tests — deliver nothing unverified; report the environment gap.
- The client IP header is absent in the local serve environment — implement per-email only, note it, and leave the per-IP branch behind the null-check (it activates when deployed behind the gateway); report this in your summary.
- You find an existing throttle mechanism in `_shared/` this plan doesn't know about.

## Maintenance notes

- Account lockout (N failed logins → temporary lock) was deliberately deferred: login doesn't traverse app code, so honest lockout needs either GoTrue's own protections (owner-configurable, Step 5) or moving login server-side — a UX-risky change that should be its own decision. Revisit if credential-stuffing shows up in Supabase auth logs post-launch.
- The throttle counts rows in `otp_verifications`; if a future cleanup job purges rows younger than 1 hour, the throttle silently weakens — keep any OTP-table retention ≥ the largest throttle window.
- When the native app ships, its auth flows hit these same edge functions — the throttle covers both platforms automatically; nothing extra to port.
- Reviewer should scrutinize: the 429 path in each function still includes CORS headers (`corsHeaders`), and the fail-open branch logs loudly enough to notice a persistently failing throttle query.
