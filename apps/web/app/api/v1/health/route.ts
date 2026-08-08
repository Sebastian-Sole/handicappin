/**
 * `GET /v1/health` — cheap liveness for the ingress canary.
 *
 * The first real `/v1` route, and deliberately the smallest one: it is the
 * end-to-end proof that the merged scaffolding (`app/api/v1/_lib`,
 * `lib/api/*`, the fail-closed public-API limiter) actually composes into a
 * response on the wire. It answers exactly one question — *did a request from
 * outside our network reach the Next.js application layer and get an
 * application-generated JSON answer back?*
 *
 * IS:     a reachability/liveness probe for the `/v1` application layer.
 * IS NOT: a dependency health check, a status page, or a diagnostic endpoint.
 *
 * ── AUTHENTICATION DECISION: UNAUTHENTICATED (and this is deliberate) ──────
 *
 * Contract §6's OpenAPI prose says "All `/api/v1` endpoints require
 * `Authorization: Bearer <access token>`". This route is the documented
 * exception, and the exception is recorded here so nobody has to re-derive it
 * from the canary's failure mode six months from now.
 *
 * **Why unauthenticated:**
 *
 *  1. **The canary cannot hold a token.** `.github/workflows/ingress-canary.yml`
 *     runs on GitHub-hosted runners specifically because they sit OUTSIDE
 *     Vercel's account boundary — that is the whole reason the workflow exists
 *     (the 2026-07-22 incident: the Vercel edge served an
 *     `x-vercel-mitigated: challenge` interstitial to every cookie-less
 *     external client, and nothing external was probing). Requiring a Bearer
 *     token would mean minting a long-lived production access token and
 *     storing it as a repo secret, i.e. putting a real user's credential in CI
 *     to test that an endpoint is reachable. `011-wave2-orchestration.md`
 *     §T13.1 states the same recommendation.
 *  2. **An authenticated health check cannot see the failure it exists to
 *     detect.** The incident was an EDGE-layer block of cookie-less,
 *     credential-less requests. A probe that carries credentials is not the
 *     traffic shape that broke; only an anonymous request reproduces it.
 *  3. **There is nothing in the body to protect.** The response body is a
 *     fixed literal. No user data, no configuration, no version string, no
 *     timestamp, no dependency roll-up. Authentication would guard a
 *     constant. (The *status code* is not equally inert — see the next
 *     section.)
 *
 * **What the decision costs, stated plainly:** an anonymous caller learns that
 * `api.handicappin.com` runs an application that answers `/api/v1/health`.
 * That is already inferable from the host's DNS record and from any `/v1`
 * 401. No further capability is granted. The route is rate-limited (below),
 * but that limiter is not what makes it safe from amplification — the next
 * section says what is.
 *
 * **Consequence for §6's two-principal-class test requirement:** it does not
 * apply here. §6 requires integration tests over both principal classes
 * because the two classes see different data under RLS. This route reads no
 * data and never constructs a principal, so there is no asymmetry to cover.
 * Every route that *does* touch data still owes those tests.
 *
 * ── WHAT THIS ROUTE TOUCHES, AND WHAT IT DELIBERATELY DOES NOT ────────────
 *
 * It touches exactly one dependency: `enforcePublicApiRateLimit` below is an
 * Upstash Redis REST round-trip on **every** request, uncredentialed. Two
 * consequences follow, stated rather than disclaimed:
 *
 *  1. **Amplification is real.** One cheap anonymous request does become a
 *     network call. The cost is bounded — a single Redis op, no fan-out — and
 *     accepted. The backstop is the **Vercel WAF**, not this limiter:
 *     `getIdentifier` trusts `cf-connecting-ip` first (`lib/rate-limit.ts`)
 *     and `api.handicappin.com` is grey-clouded — DNS-only to Vercel, with no
 *     Cloudflare hop to overwrite that header — so a caller hitting the API
 *     host directly can mint a fresh bucket per request by varying it.
 *     `lib/rate-limit.ts` documents that trade-off deliberately; it is not
 *     this route's to fix, but nothing here should be read as claiming the IP
 *     limiter carries flood protection on this host. It does not.
 *  2. **The 503 is a one-bit dependency oracle.** It tells any stranger the
 *     limiter is unavailable, and health is the ONLY `/v1` route where an
 *     anonymous caller can observe that — every other route authenticates
 *     first, so an anonymous caller 401s and learns nothing. Accepted: one
 *     bit about one dependency, and it is the exact bit the canary exists to
 *     read.
 *
 * What stays out is fan-out. This route does NOT probe Postgres, Supabase
 * Auth, or Stripe: that would multiply the per-request cost and widen (2)
 * from one bit into a report of WHICH dependency is down. Dependency health
 * belongs to internal monitoring, not to a public liveness probe.
 *
 * ── RATE LIMIT: the `reads` family, keyed by IP ───────────────────────────
 *
 * Family `"reads"` — named explicitly, never omitted. `lib/rate-limit.ts`
 * documents that family as "Every `/v1` GET (health, courses, tees, rounds)",
 * so health is already inside its frozen definition; inventing a `health`
 * family would mean adding an env var and a budget to `env.ts` +
 * `lib/rate-limit.ts`, both of which are frozen shared surface. Omitting the
 * family argument instead falls back silently to the legacy unfamilied
 * `ratelimit:public-api` bucket — no type error, no test failure, just the
 * wrong budget shared with every other caller.
 *
 * The limiter is called with **no principal argument at all**, not with a
 * composed key string. There is no principal to pass (the route is
 * unauthenticated), so `getIdentifier` falls through to its `ip:{ip}`
 * encoding — which is exactly what contract §3 prescribes for pre-auth
 * traffic. Passing a hand-composed string here would take the limiter's
 * `string` branch, which means `{ userId: <that string> }`, and would both
 * mis-encode the key and mislabel `identifierKind` in every Sentry
 * fail-closed alert.
 *
 * Because the key is `ip:{ip}` while authenticated reads key on
 * `user:{sub}` / `client:{id}:user:{sub}`, anonymous health traffic shares a
 * bucket only with other anonymous traffic from the same IP. A NAT gateway
 * hammering `/v1/health` cannot consume a signed-in user's read budget.
 *
 * **The limiter is fail-closed, and that propagates to the canary.** If
 * `RATE_LIMIT_ENABLED` is not `"true"`, or the KV credentials are missing, or
 * Redis throws, this route answers `503 service_unavailable` and the canary
 * goes red. That is correct, not a false alarm: in that state *every* `/v1`
 * route is answering 503, so the surface really is down. The internal reason
 * (`disabled` / `missing-credentials` / `init-error` / `runtime-error`) goes
 * to Sentry from inside the limiter and never appears in the body or headers
 * (§3) — the registry stays closed.
 *
 * ── ENVELOPE ──────────────────────────────────────────────────────────────
 *
 * Both responses go through the shared scaffolding, so both carry
 * `X-API-Stability: internal` (§4) and any non-2xx is RFC 9457
 * `application/problem+json` (§1). Only `GET` is exported: any other method
 * gets the framework's own 405, which §1 explicitly places outside the
 * contractual envelope.
 *
 * ── HOST SCOPING ──────────────────────────────────────────────────────────
 *
 * Contract §1: `api.handicappin.com` is the only SUPPORTED base host. This
 * route adds no host guard of its own. Host handling already lives one layer
 * up, in `apps/web/proxy.ts` → `lib/host-guard.ts`, whose allowlist admits
 * `handicappin.com`, `www.handicappin.com` and `api.handicappin.com` — so
 * `/api/v1` remains *reachable* on the web hosts even though only the API
 * host is *supported*, exactly the state §1 describes. Narrowing that is a
 * cross-cutting `/v1` decision (it would change behavior for every route and
 * require updating both api-host canary probes from PR #170), not something
 * a single route should fork. The canary probes the API host only.
 *
 * Contract: `docs/research/api-platform/plans/005-phase0-contract.md`
 * §1 (envelope + host scoping), §3 (rate limits), §4 (stability header),
 * §6 (auth). Plan: `plans/011-wave2-orchestration.md` §T13.1.
 */

import {
  errorResponse,
  jsonResponse,
  rateLimitResponse,
} from "@/app/api/v1/_lib";
import { enforcePublicApiRateLimit } from "@/lib/rate-limit";

/**
 * Never prerendered, never cached at the framework layer. A liveness probe
 * that can be served from a build-time snapshot reports the health of the
 * build, not of the running deployment.
 */
export const dynamic = "force-dynamic";

/**
 * The entire response body. A frozen literal — no timestamp, no version, no
 * deployment id, no dependency roll-up. It exists only so the canary can tell
 * a real application JSON answer apart from an HTML challenge interstitial.
 */
const HEALTH_BODY = { status: "ok" } as const;

/**
 * `no-store`, because a cached 200 defeats the probe.
 *
 * The canary's job is to prove the ORIGIN answered. If Vercel's CDN or
 * Cloudflare is allowed to serve a stored copy, a green canary would only
 * prove that a cache still holds a response from before the outage — the
 * exact failure mode the workflow exists to catch. `Response` bodies from
 * route handlers are not CDN-cached by default, so this is belt-and-braces
 * against a future default change or an edge config that adds caching.
 */
const HEALTH_CACHE_HEADERS = { "Cache-Control": "no-store" } as const;

export async function GET(request: Request): Promise<Response> {
  const instance = crypto.randomUUID();
  try {
    // Family named; principal omitted on purpose (see the header). Both
    // arguments fail QUIETLY if you get them wrong.
    const limit = await enforcePublicApiRateLimit(request, undefined, "reads");
    if (!limit.success) {
      return rateLimitResponse(limit, { instance });
    }

    return jsonResponse(HEALTH_BODY, 200, {
      headers: { ...HEALTH_CACHE_HEADERS },
    });
  } catch (error) {
    return errorResponse(error, { instance, route: "GET /v1/health" });
  }
}
