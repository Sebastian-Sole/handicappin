# Black Hat Review — external-auth-model

Perspective: caution and risk. Verdict: **mixed** — the architectural direction (B over A/C) is defensible, but the recommendation as written understates the security posture and beta exposure, and ships with a mitigation that is partly security theater.

## 1. The tRPC allowlist does not bound the token. The token bounds the token.

The recommendation's centerpiece hardening — "~50 lines: tokens bearing client_id may only call submitScorecard/course-search/read-own-rounds" — only constrains requests that arrive through `apps/web/server/api/trpc.ts`. An OAuth-issued access token is, by Supabase's own docs (quoted in the research), a **full session token**. That token is also valid against:

- **PostgREST directly** (`<project-ref>.supabase.co/rest/v1/...` with the public anon key + the token) — every RLS-permitted table (rounds, holes, profile, billing state) is readable and writable, bypassing tRPC entirely. The anon key is public by design; the fitness app binary contains everything needed.
- **The GoTrue Auth API** (`/auth/v1/user`) — `auth.updateUser()` can change the user's **email and password**. A compromised fitness app, a token exfiltrated from its storage, or a malicious SDK dependency in that app is an account-takeover vector on handicappin, not just a "submit rounds" vector.

The research file (155 lines, read in full context) never mentions PostgREST or GoTrue exposure. This means the "optional RLS backstop" is not optional — it is the *only* real control — and even RLS policies cannot restrict the Auth API surface (email/password change is not an RLS-governed table write). Nothing in Option B, as shipped today, can make this token less than a full account credential. The honest framing is: **v1 grants the fitness app the same blast radius as a stolen handicappin password**, and the allowlist is attribution/UX hygiene, not a security boundary.

## 2. Beta dependency is a real tail risk, and "fallback to A" is not free

- No GA date, no post-beta pricing. Supabase has a track record of reshaping auth-adjacent surfaces (API-key migration 2025, GoTrue churn). If post-beta pricing lands per-MAU or plan-gated, the first external integration is hostage to it.
- The claimed low-regret fallback ("swap to A behind the identical Bearer path") quietly discards the consent grant, per-app revocation, and client_id attribution that justified choosing B — and any RLS policies keyed on `auth.jwt()->>'client_id'` silently stop matching, *widening* access on fallback. A fallback that fails open is a trap worth naming.
- Conversely, if the beta survives but Phase 2 scopes slip indefinitely, the "do not onboard third parties until real scopes exist" gate means the third-party ambition is blocked on an unowned roadmap with no date. The recommendation treats Phase 2 as inevitable; it is not.

## 3. Revocation and rotation semantics need adversarial verification, not happy-path spiking

- The research asserts `getUser(token)` checks revocation server-side. Verify the *latency and mechanism*: if access tokens are JWTs with e.g. 1-hour expiry and any code path (now or later — a future REST handler, an edge cache, local JWKS validation which the research itself names as fallback) validates locally, revoked tokens live until expiry. The documented fallback (JWKS) **removes** the revocation check the recommendation depends on. That contradiction is inside the research itself.
- Refresh-token rotation on flaky mobile networks is a classic silent-logout generator (rotation + retry = family invalidation). The fitness app is exactly that client. Budget for it or v1's first support tickets are "it keeps signing me out."

## 4. Operational single points of failure

- The whole model is gated on a **dashboard-configured** Cloudflare/Vercel challenge bypass. That is not in code, not in review, not in CI. One security-settings change (or Cloudflare rule reorder) bricks the fitness app in production with HTML 429s that surface as JSON parse errors. This needs a synthetic probe (cookie-less Bearer request against prod on a schedule), not a one-time spike checkbox.
- The custom-domain `.well-known/oauth-authorization-server` issue (open Jan 2026) intersects directly with topic 3's likely `api.handicappin.com` choice. If unfixed, discovery breaks precisely in the configuration you plan to run.

## 5. Cost and scope optimism

"2–4 days more" excludes: bespoke consent UI (plus the unanswered web-native parity question — a consent screen reachable from a native OAuth flow may trigger the parity gates), the RLS client_id policies (now load-bearing, see §1), the fitness-app-side OAuth library integration and secure token storage, and the adversarial spike items in §3. Realistic is 1.5–2.5 weeks, which changes the B-vs-A calculus the recommendation leans on.

## Must-address before locking

1. **Reclassify the RLS client_id deny-policies from "optional backstop" to mandatory**, and explicitly document that the tRPC allowlist is not a security boundary because PostgREST and GoTrue accept the token directly. Decide whether GoTrue self-service endpoints (email/password change via an OAuth token) are acceptable v1 risk — and check whether Supabase offers any lever there.
2. **Extend the spike to adversarial cases**: token used directly against `/rest/v1` and `/auth/v1/user`; revocation latency after `revokeGrant`; behavior of the JWKS fallback path (which drops revocation).
3. **Define beta exit criteria in advance**: what pricing/GA/breakage outcome triggers migration, and acknowledge the A-fallback fails open (client_id policies stop matching, consent/revocation vanish).
4. **Make the Cloudflare bypass continuously verified** (scheduled cookie-less probe), not a one-time precondition.

File reviewed: `/Users/sebastiansole/Documents/handicappin/docs/research/api-platform/topics/external-auth-model/research.md`
Code verified: `/Users/sebastiansole/Documents/handicappin/apps/web/server/api/trpc.ts` (cookie-precedence + Bearer path as described).
