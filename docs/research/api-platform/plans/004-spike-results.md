# 004 — OAuth 2.1 Spike Results

**Date run:** 2026-07-28 · **Timebox:** ~2 days budgeted · **Actual:** a few focused hours
**Verdict: GO for OAuth B.** The Supabase OAuth 2.1 authorization server (beta) works end-to-end for the "Connect handicappin" flow. Every server-side criterion passed against the local stack; the prod cookie-less canary passed against the real origin. No "multi-day beta archaeology" tripwire was hit — the feature came up cleanly. Two required build-side hardenings and a small set of owner actions (hosted-project enablement) are listed below.

## Environment used

- **Local Supabase stack** (`supabase start`, project `handicappin`), GoTrue `v2.184.0`, CLI `v2.62.5`. OAuth server enabled via `supabase/config.toml` `[auth.oauth_server]` (see "Config change" below). This is the non-prod surface the plan asked for — prod auth settings were NOT modified.
- **Prod** (`lssnaapatrurmhbbqadb`): read-only canary curl only. Management-API read of prod auth config was blocked by the local command classifier (not attempted further); not needed for the spike.
- **supabase-js** pinned `2.95.3` (auth-js `2.95.3`) — the version in `apps/web/package.json`.
- Reproduction scripts: `scratchpad/spike.mjs` (full flow), `spike2.mjs` (RLS + refresh race), `spike3.mjs` (OAuth-endpoint refresh). Run from `apps/web/` so `@supabase/supabase-js` resolves.

## Per-criterion verdict table

| # | Criterion | Verdict | Evidence |
|---|-----------|---------|----------|
| i | `auth.getUser(<oauth token>)` returns the user | **PASS** | `getUser` returned the exact `auth.users` id; `sub` matched. |
| ii | `ctx.supabase` queries RLS-scoped to that user | **PASS** | OAuth token against `/rest/v1/profile` returned **only the token-owner's row** with two users seeded (decoy row invisible). `auth.uid()` resolves from the token `sub`. |
| iii | `revokeGrant` invalidates the token; latency measured; JWKS-fallback caveat | **PASS** | `revokeGrant({clientId})` → `getUser` began failing at **~47 ms**. Post-revoke plain refresh → 400. Caveat holds: revocation is enforced by GoTrue's `getUser` network check (our `getUserFromBearerToken` path). A consumer that validates locally via cached JWKS/`getClaims()` would **silently miss revocation** until token expiry — do NOT switch the server to local JWKS validation for external tokens. |
| iv | `client_id` **present** on OAuth tokens **and absent** on first-party tokens | **PASS — conditional on a one-line hook fix** | GoTrue **natively injects `client_id`** into OAuth tokens. BUT the project's `custom_access_token_hook` (`supabase/migrations/20251012223407_add_billing_jwt_hook.sql`) rebuilds claims from a **fixed whitelist that omits `client_id`**, so it currently **strips** it. Proven empirically: with the stock hook, OAuth token had **no** `client_id`; after adding `'client_id'` to the preserved-claims array, the OAuth token carried `client_id=<oauth client uuid>` and the first-party password token still had **none**. **Required fix:** add `'client_id'` (and, forward-looking, `'ref'`) to the `FOREACH claim IN ARRAY [...]` list in the hook. Without it, every downstream hardening silently fails open. |
| v | OAuth token links to an EXISTING `auth.users` account (A↔B both directions) | **PASS** | The consenting user was a pre-existing account; the issued token's `sub` equalled that user id. The A→B upgrade path is real. |
| vi | Adversarial: OAuth token direct against PostgREST + GoTrue (incl. `auth.updateUser`) | **PASS (surface documented; confirms deny-policies MANDATORY)** | With the public anon `apikey`, the OAuth token: **reads** `/rest/v1/profile` (200), **writes** `/rest/v1/profile` via PATCH (200 — no deny-policy exists yet), hits GoTrue `GET /auth/v1/user` (200), and **succeeds** at `updateUser(user_metadata)` (200). The **email-change** attempt returned 500, but only because the local `send_email` hook is misconfigured — that is a **local-env artifact, NOT a security control**; the account-takeover surface must be treated as **reachable**. Conclusion: the tRPC allowlist covers none of this; **RLS `client_id` deny-policies on billing/profile + an explicit `auth.updateUser` decision are mandatory 2b work.** |
| vii | Full mobile round-trip from a real device build | **PARTIAL / BLOCKED-NEEDS-OWNER** | Verified programmatically: auth-code **+ PKCE (S256)**, consent approve, token exchange, and **refresh rotation** all work. Key finding: OAuth session refresh tokens are **rejected by the plain GoTrue token endpoint** (`invalid_client`, "Client authentication required for OAuth session") — they must be refreshed via **`POST /auth/v1/oauth/token` with `grant_type=refresh_token` + client auth**. That fits fitbull's **server-side-in-Convex confidential-client** model exactly and largely removes the on-device public-client race. The reuse-detection family-kill worry is further defused by `refresh_token_reuse_interval = 10` (a 10 s grace window; concurrent reuse within it returned 200, not a family revocation). What remains untestable here: real-device deeplink handling + secure token storage — those need the **fitbull client build, which does not exist yet**. |
| viii | Cookie-less non-browser request reaches PROD origin past the challenge | **PASS** | `curl` with no cookies to `https://www.handicappin.com/api/trpc/course.getCourseById` → **HTTP 200**, `server: cloudflare`, **no `x-vercel-mitigated` / no challenge**. (A cookie-less **POST** returns 405 because that query is GET-only — that is method routing, not a challenge.) Matches DECISIONS: Bot Protection flipped to Log 2026-07-22. Must remain a **permanent scheduled canary**. |

## Pre-build verifications (spike §6)

- **supabase-js consent helpers present in pinned 2.95.3 — PASS.** All ran at runtime: `supabase.auth.oauth.getAuthorizationDetails / approveAuthorization / denyAuthorization / listGrants / revokeGrant`, plus admin client management `supabase.auth.admin.oauth.createClient / listClients / getClient / updateClient / deleteClient`. No version bump needed for the consent page.
- **Custom Access Token Hook stamps a forward-compatible scope claim — VERIFIED FEASIBLE.** The hook already fires for OAuth issuance (billing claims appeared on the OAuth token). Adding a `scope`/`rounds:write` claim is a one-line addition in the same function. Do it **together with the `client_id` passthrough fix** (criterion iv).
- **Custom-domain `/.well-known` + consent path (topic 3) — OPEN ISSUE, owner-gated.** Supabase `auth#2408` (open as of Mar 2026): on hosted projects the authorize endpoint redirects to `{SITE_URL}/oauth/consent`, and the **Authorization Path field may be hidden** in the dashboard (`GOTRUE_OAUTH_SERVER_AUTHORIZATION_PATH` not always exposed). Locally it worked via `config.toml`. handicappin must **host its own `/oauth/consent` page** (Supabase serves no default UI). `api.handicappin.com` does not exist yet (pending W0 owner item) — sequence the discovery-endpoint check for the custom domain when it lands.
- **Beta / Phase-2 scope status (discussion #38022) — unchanged, reinforces tripwire #8.** As of the latest comments (Feb 2026) **scope management is still unimplemented; no GA date**. OAuth tokens remain **full-privilege session tokens**; authorization is only via RLS. Public beta since 2025-11-26, free during beta. This does not block fitbull (first-party) but hard-confirms: **no external third party until real scopes exist**, and **RLS deny-policies are the only real control**.

## JWT signing note (new finding)

Local signs with **HS256**. Requesting the `openid` scope forced OIDC **ID-token** generation, which **requires an asymmetric algorithm (RS256/ES256)** and returned 500 on HS256. fitbull needs **access tokens, not ID tokens**, so HS256 is fine and our server validates tokens via `getUser` (network), not local JWKS. If fitbull ever wants OIDC id_tokens or JWKS-based local validation, prod must migrate signing keys to RS256/ES256 first. **Action for the consent flow: do not request the `openid` scope** (use `profile email` or app scopes) unless asymmetric signing is enabled.

## Config change made (local only; uncommitted — for main to review)

Added to `supabase/config.toml` (worktree, not committed):

```toml
[auth.oauth_server]
enabled = true
authorization_url_path = "/oauth/consent"
allow_dynamic_registration = false
```

The local stack currently has OAuth server **enabled** and the billing hook was **restored to its committed definition** after the criterion-iv proof (local DB left clean). No prod changes were made.

## Overall verdict

**GO for OAuth B.** Spike passed. It is emphatically NOT the "beta archaeology" fallback trigger — the mechanism is real and cheap to stand up.

### Required build-side hardenings (2b, gating)
1. **Hook `client_id` passthrough (one line).** Add `'client_id'` (and `'ref'`) to the preserved-claims array in `custom_access_token_hook`, or criterion iv fails open. Stamp the forward-compatible scope claim (`rounds:write`) in the same edit.
2. **RLS `client_id` deny-policies** on billing/profile tables (`deny writes when auth.jwt()->>'client_id' IS NOT NULL`) — the OAuth token reaches PostgREST/GoTrue directly; the tRPC allowlist covers neither. Migration under `supabase/`.
3. **`auth.updateUser` decision, in writing.** The OAuth token can mutate account metadata (and, but for the local SMTP artifact, email/password) directly against GoTrue. Decide the accepted v1 blast radius and whether any Supabase lever blocks it.
4. Reject `client_id`-bearing tokens in tRPC context; accept them only at `/api/v1` (005).
5. Host `/oauth/consent` as a real route; settle its parity status (`INTENTIONAL.webOnly` vs native twin) before build.

### Owner actions needed (BLOCKED-NEEDS-OWNER)
- **Enable OAuth 2.1 server on the hosted `handicappin` project.** Dashboard → Authentication → OAuth Server → enable, and set **Authorization Path = `/oauth/consent`** (or push `config.toml`'s `[auth.oauth_server]` via the CLI). This is an **additive** change (new `/auth/v1/oauth/*` endpoints) that does **not** alter existing email/Google web+native login — but it touches prod auth, so it is explicitly **owner-approved, not for the agent**. If the Authorization Path field is hidden (issue #2408), a config push or Supabase support ticket may be required.
- **`api.handicappin.com`** (already a pending W0/ingress item): once it exists, confirm `/.well-known/oauth-authorization-server` discovery (issuer + JWKS URLs) resolves on the custom domain before fitbull points at it.
- **Beta exit criteria to write down** (per condition §5): post-beta pricing ceiling, breaking-change cost budget, GA-slip decision date — monitored via the Supabase changelog + discussion #38022 (Phase-2 scopes still unshipped).
```
