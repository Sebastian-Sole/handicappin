# Blue Hat review — external-auth-model

**Perspective:** process control — was the right question asked, was the method sound, what should the decision process be?
**Verdict:** agree (with process conditions before lock)

## 1. Was this the right question?

Mostly yes. "Which issuance model satisfies the existing Bearer path fastest without dead-ending the platform ambition" is the correct v1 framing, and it correctly treats the codebase's existing Bearer/RLS plumbing as the fixed constraint rather than re-opening the stack question.

One framing defect: a genuinely upstream **product** decision was demoted to open question #4 — *do fitness-app users share handicappin identity, or keep separate identities with an explicit "Connect handicappin" consent moment?* That is not an open question to park; it is a decision input that changes the option space. If the owner wants separate identities, Option A is not merely inferior, it is **eliminated**, and the A-as-fallback story weakens. The decision process should force this call at the gate, before the spike is even scheduled, because it determines what the fallback plan is if the beta blocks.

## 2. Was the method sound?

Largely yes — this is one of the better-grounded topics:

- **Sources and recency:** primary sources only (Supabase docs, GitHub discussion #38022, vendor developer docs), all with explicit fetch dates of 2026-07-20 (today). The beta-status claim, the "no granular scopes" limitation, and the Phase 2 roadmap are each tied to a citable source rather than asserted. Good.
- **Codebase grounding:** the load-bearing claim (Bearer token → `auth.getUser()` → request-scoped anon client → free RLS) matches the prior verified assessment of `apps/web/server/api/trpc.ts`. The reduction "credential question = what issues Supabase-recognized tokens" is a genuine insight that came from reading the code first, not the vendor docs first. That's the right order.
- **Prior art:** four comparable APIs, unanimous conclusion, including the honest counter-note that Garmin's program is closed and Terra uses a different model. Directionally sufficient; no cherry-picking detected.
- **Self-skepticism:** the research names its own beta risks (no GA date, unknown pricing, custom-domain metadata bug, supabase-js gap) and mandates a spike on its own load-bearing assumption. That is sound process.

## 3. Where the process is inconsistent

1. **"Confidence: high" contradicts the spike gate.** The single fact everything rests on — `auth.getUser()` accepting OAuth-server-issued tokens exactly like session tokens — is listed as *unverified* (open question #1). A recommendation cannot be high-confidence when its mechanism is untested. Correct label: **high conditional on a passed spike**. This matters for process because "high confidence" invites skipping the spike; the spike must be a hard gate, not a suggestion.
2. **Cross-topic sequencing is acknowledged but not enforced.** The Cloudflare/Vercel challenge (topic 3) is a strict precondition — no token model reaches the origin without it — and the custom-domain `.well-known` bug couples this topic's viability to topic 3's domain choice. The decision process should be: resolve topic 3's domain decision → run the combined spike (bypass + OAuth token) → then lock this topic. Locking auth-model first risks re-litigating if `api.handicappin.com` trips the metadata bug.
3. **Parity rule left dangling.** The consent page is new web UI; under `web-native-parity` it either needs a native twin or an `INTENTIONAL.webOnly` entry. Small, but it's a known hard pre-commit gate — the plan should name the choice now, not discover it at commit time.

## 4. Decision-process quality of the recommendation itself

The shape of the recommendation is process-excellent: it is **reversible** (A remains available behind the byte-identical Bearer path if the beta blocks), **staged** (spike → v1 same-developer → third parties only after real scopes exist), and **cheap to be wrong about** (~2-4 days delta). The explicit "do not onboard external third parties until scopes ship" tripwire is exactly the kind of pre-committed stop condition a beta dependency needs. One addition: define the **exit criteria** for the beta bet now — e.g. "if post-beta pricing exceeds X or GA slips past Y date, revisit Option C for the partner tier" — so the monitoring of the changelog/#38022 has a trigger attached, not just a watch.

## 5. What would change the answer

- Spike failure (`getUser()` rejects OAuth tokens, or `client_id` absent) → falls back to A for v1, C re-enters for the platform tier.
- Post-beta pricing hostile, or beta withdrawn → same.
- Owner chooses separate product identities → A eliminated; B becomes the only path and the fallback plan must be rewritten (this is why question #4 must be answered first).
- Supabase Phase 2 scopes shipping soon → strengthens B further; the interim allowlist becomes throwaway (acceptable, it's ~50 lines).

## Must-address before locking

1. Answer the identity/consent product question (open question #4) at the gate — it determines whether the A-fallback is real.
2. Re-label confidence as conditional; make the 1-day spike a hard gate with pass/fail criteria written down (getUser acceptance, RLS scoping, revokeGrant, client_id presence).
3. Sequence with topic 3: domain decision + Cloudflare bypass verified in the same spike, including the custom-domain `.well-known` bug check.
4. Attach explicit exit criteria to the beta dependency (pricing/GA tripwires) and decide the consent page's parity status (`INTENTIONAL.webOnly` or native twin).
