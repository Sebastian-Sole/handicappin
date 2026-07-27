# White Hat review — external-auth-model

**Reviewed:** 2026-07-20 · **Perspective:** facts and information only · **Verdict:** agree

Method: re-verified the codebase claims directly against `apps/web/server/api/trpc.ts`, `apps/web/env.ts`, and `apps/web/app/api/`; re-fetched the three load-bearing external sources (Supabase OAuth server docs, OAuth flows doc, GitHub discussion #38022) on 2026-07-20.

## 1. Claims verified this session (independently confirmed)

**Codebase (read directly):**
- The Bearer path is exactly as described: `extractBearerToken()` → `getUserFromBearerToken()` via `supabase.auth.getUser(token)` → `createBearerTokenSupabaseClient()` forwarding `Authorization: Bearer <token>` on every PostgREST request (trpc.ts lines 31–174). Cookie auth is checked first; bearer is the fallback — matches the research.
- `apps/web/app/api/` contains only `ai, auth, billing, cron, legal, notifications, stripe, trpc, webhooks` — the "no PAT/API-key infrastructure exists" claim is accurate.
- `SUPABASE_SERVICE_ROLE_KEY` is declared in `apps/web/env.ts` (lines 40, 94) as stated.

**Supabase docs (re-fetched 2026-07-20):**
- The verbatim caveat is real and current: "All OAuth access tokens have full access to user data (same as regular session tokens), with the addition of the `client_id` claim."
- "Your existing Row Level Security policies automatically apply to OAuth tokens" — confirmed verbatim on the OAuth server doc.
- `revokeGrant`: "all active sessions and refresh tokens for that client are immediately invalidated" — confirmed verbatim. Refresh-token rotation confirmed.
- An additional fact the research understates slightly in its favor: the flows doc now states explicitly "Custom scopes are not currently supported. Only the standard scopes listed above are available." The no-scopes limitation is thus doc-official, not merely inferred from the discussion.

**Discussion #38022 (re-fetched):**
- Public beta since 2025-11-26; scope management explicitly Phase 2 ("No scope management initially" in Phase 1; "Scope management system & customization of tokens" in Phase 2); custom-domain `/.well-known/oauth-authorization-server` issue, `amr`/AWS-STS incompatibility, and the mobile-deeplink fix (auth PR #2298) all confirmed as reported.

## 2. Claims that remain assumptions (correctly or incorrectly labeled)

- **`auth.getUser()` accepting OAuth-issued tokens** — this is an *inference*, not a documented fact. No doc sentence states `getUser(token)` validates OAuth access tokens; the research infers it from tokens being session-backed (revocation kills "sessions"). The research correctly labels this the single load-bearing assumption and gates the recommendation on a 1-day spike. Correct handling.
- **First-party session tokens carry no `client_id` claim** — plausible (docs describe `client_id` as an OAuth-flow addition) but never verified. Both proposed hardenings (allowlist + RLS backstop) depend on this being true for web/native tokens. Should be an explicit spike check, not folded in silently.
- **"Free during beta on all plans"** — sourced to the feature page; not re-verified this session. Post-beta pricing genuinely unpublished.
- **"~2–4 days of work" and "~50-line allowlist"** — estimates, not evidence. No basis to dispute, but they are the softest numbers in the summary.
- **Prior-art table (Strava/Whoop/Garmin/Terra)** — cited with URLs dated 2026-07-20 but not re-verified this session. The specific details (Strava 6h tokens, single-player mode, Garmin program suspension) are consistent with known facts as of the knowledge cutoff and are not load-bearing for the A/B/C choice — they only inform the "scoping is table stakes for third parties" conclusion, which is robust across all four sources.

## 3. Data still missing and obtainable

1. **The spike itself** — the only material unknown; 1 day resolves items in §2. Add to it: confirm first-party tokens lack `client_id`.
2. **Supabase changelog since Feb 2026** — discussion #38022 comments run only through Feb 2026; five months have elapsed. A changelog sweep could reveal Phase 2 scope progress or GA news the research would not have caught from that thread alone.
3. **supabase-js version check** — confirm the repo's pinned supabase-js exposes `auth.oauth.getAuthorizationDetails` / `approveAuthorization` / `revokeGrant` (the consent page depends on these client helpers existing in the installed version).
4. **Custom Access Token Hook availability** — the research mentions it as an option for per-client claims; whether it is enabled/available on the project's current Supabase plan is unchecked.
5. **Cloudflare/Vercel challenge bypass** — acknowledged as topic 3, but factually it is a precondition to any spike against production-like infrastructure; the spike should run against an environment where this is already resolved or staging without the challenge.

## 4. Factual assessment of the option analysis

- Option A cons are factual, not rhetorical: shared `auth.users` row, absence of `client_id`, spoofable headers — all follow directly from verified mechanics.
- Option C's central factual claim — opaque keys fail `getUser()` and therefore force service-role + hand-rolled authz or unsupported JWT minting — is consistent with the verified code path (`getUser(token)` validates against Supabase Auth session state; an opaque non-JWT key cannot pass it).
- Option B's "zero changes to trpc.ts" is conditional on the §2 spike assumption holding; the research states this accurately.

## Verdict

**Agree.** The evidence base is unusually clean: every codebase claim checked out on direct read, every load-bearing external quote reproduced verbatim on a fresh fetch, and the one genuine unknown is explicitly identified and gated by a cheap spike with a stated fallback (Option A behind the identical Bearer path). The recommendation's confidence level ("high") is justified *conditional on the spike*; the residual items in §3 are cheap to obtain and none plausibly reverses the ranking of B over A and C.
