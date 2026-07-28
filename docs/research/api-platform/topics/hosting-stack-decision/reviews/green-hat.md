# Green Hat Review — hosting-stack-decision

Perspective: creativity and alternatives. What was NOT considered, and can the problem be reframed away?

Verdict: **agree** with the hosting conclusion (stay on Next.js, extract the service) — but the recommendation solves a bigger problem than consumer #1 actually has, and several cheaper reframes were left on the table.

## 1. The biggest reframe is buried in the open questions instead of driving the plan

"Does the fitness app share the same Supabase project?" is listed as open question #3. It should be question #1, answered before anything is built, because if yes, **consumer #1 may need no new API surface at all**:

- The bearer path in `apps/web/server/api/trpc.ts:141-184` already accepts a Supabase access token with correct RLS scoping. It was built for exactly this shape of client (same developer, separate app).
- Same developer means the fitness app can consume a typed tRPC client (or at minimum the zod contracts) from the monorepo or a published `packages/api-contracts` — the whole justification for REST ("tRPC contract is internal-only") evaporates when the one consumer is first-party and can share types.
- Deliverable split: **ship the fitness integration now on the existing tRPC bearer rails** (only real blocker: the Cloudflare challenge), and design `/v1` REST later, informed by an actual third party's needs rather than a hypothetical one. The research fuses two deliverables — "integrate my other app" and "become an API platform" — and prices the first at the cost of the second. The service extraction is still worth doing now (it's cheap insurance either way), but the REST surface, api.<domain>, Idempotency-Key machinery, and versioning discipline can all wait for a consumer that can't share code.

## 2. Options list is missing PostgREST / Postgres RPC

The repo's own architecture already made the database the orchestrator: a trigger on `round` enqueues, pg_cron drains, an Edge Function recalcs. The unconsidered option D+ is to push the submit pipeline (or its core insert + validation) into a Postgres function exposed via Supabase RPC — RLS applies, the trigger fires, zero API host exists at all. I think it *loses* (billing gating, course auto-creation, and email/PostHog live comfortably in TypeScript, and 700 lines of plpgsql is a maintenance horror), but a research doc recommending "no new service" should have named and rejected the most radical "no service at all" option. Its absence suggests the option space was framed as "where do we host the handlers" rather than "do we need handlers".

## 3. Problems being solved in middleware that could disappear in the schema

- **Idempotency-Key header machinery** is the transactional-outbox of API design — real work (storage, TTL, replay semantics). A natural-key uniqueness constraint (`userId + courseId + teeTime`, or a client-supplied `externalRef` unique per user) makes POST /v1/rounds idempotent with one migration and turns retries into a 409/200-replay for free.
- **The free-tier delete-on-race compensation** (round.ts:949-992) is already flagged in open question #6 — but framed as "should we". Green hat: a DB-side count constraint (trigger or deferred check) doesn't just make the API retry-safe, it *deletes* the compensation code from every future adapter. Do it as part of the extraction, not later.

Both reframes shrink the extracted service, which is the moment to do them.

## 4. Cloudflare challenge: a structural bypass wasn't considered

The plan treats the 429-HTML challenge as a dashboard rule to maintain. Alternative: make `api.<domain>` a **grey-clouded (DNS-only) record pointing straight at Vercel** — the challenge layer never sees API traffic, no bypass rule to silently break on a Cloudflare settings change, and Vercel's own WAF/rate-limits (plus Upstash) still protect the endpoint. Since the plan already reserves api.<domain> as split insurance, this is free to combine.

## 5. A missing middle rung between Option A and Option B

The trigger list says "leave Next.js when X fires" and jumps straight to Hono/Fastify + new infra. There is a cheaper split that wasn't named: **a second Vercel project deploying the same monorepo, building only the API routes** (or a minimal Next entry that mounts them). Independent deploys, independent SLA/alerting, same code, same packages, zero new framework — it services the two most likely triggers (deploy-cadence divergence, independent SLA) for roughly a config file. Several triggers on the list should point at this rung, not at a rewrite-adjacent new service.

## Must address before locking

1. Answer the shared-Supabase-project question first — it determines whether consumer #1 needs any REST surface, which is most of the proposed launch scope.
2. Decide idempotency at the schema level (natural key / externalRef + free-tier DB constraint) during extraction, not as header middleware later.

None of this overturns the recommendation — the hosting analysis is sound and the extraction sequencing is right. The creativity gap is scope, not stack.
