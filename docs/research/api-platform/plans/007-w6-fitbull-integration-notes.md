# 007 — W6: fitbull-side integration notes

**Workstream:** W6 · **Status:** PENDING · **Billing-gated:** No
**Depends on:** 004 (W2 auth), 005 (W4 contract), 006 (W5 sync) — the contract must exist to write against.
**Blocks:** nothing (verified by fitbull's own integration tests; the canary proves reachability).

---

## Goal

A brief handoff doc for the **separate** Convex repo (not this repo). Concrete but short — it's another codebase. It tells the fitbull integrator the base URL, auth, day-1 call list, idempotency, polling, and error handling.

## Background

fitbull is the owner's separate Convex fitness app and the first API consumer. It holds tokens **server-side in Convex** (not on-device), issued by the OAuth Connect flow (004). Its base URL is `api.handicappin.com` **from the first commit** — never `handicappin.com`, or API availability re-couples to the marketing-site edge posture, the exact thing 001/W0 exists to prevent. The v1 write is a synchronous 201 with a provisional index (`handicapRevision:"pending"`); the returned index is provisional until the async recompute clears. Over-limit rounds come back as a **201 with a quarantined status** (excluded from handicap/count, unlocked on upgrade) — not a 403 — so the integrator must handle the quarantined status as a successful-but-excluded outcome, not an error.

## Scope (a committed integration note, this repo's `docs/` or handed to the fitbull repo)

- **Base URL** = `api.handicappin.com` from the first commit (never `handicappin.com`).
- **Tokens** held server-side in Convex (not on-device); OAuth Connect flow (004) issues them.
- **Day-1 call list:**
  - `POST /rounds` (with `externalId` per submission for idempotency),
  - `GET /courses` / `GET /tees` (resolve `teeId` before writing),
  - `GET /profile` + `GET /rounds` (polling),
  - `POST /courses` (catalog miss),
  - `POST /profile/provision`.
- **Poll cadence + refetch-on-foreground** per 006; treat the returned index as provisional until `handicapRevision` clears.
- **422 taxonomy + RFC 9457** handling; 409/200 duplicate semantics per 003.
- **Quarantine handling:** a 201 with quarantined status means the round was stored but excluded until upgrade — surface it as such, not as a failure.

## Binding conditions (verbatim)

From **golf-api-landscape §B**:

> 6. **Evaluate the null-surface v1 before locking REST** (Green — strongest surviving alternative). ... If REST /api/v1 is chosen, choose it with reasons recorded — "REST for an audience of one" must not happen by inertia.
> 7. **Write-only-by-default as a stated API design principle** (Green): scorecard-in, never handicap-out. This collapses most of the USGA/NGF governance surface for v1 and for future phase-2 partners.

(The REST choice is already recorded as deliberate in DECISIONS #5; note write-only-by-default applies to third parties, not to fitbull's own reads — DECISIONS §Superseded.)

## Non-goals

- Any code in this repo — this is a handoff doc for the Convex repo.
- Realtime / websocket integration — out of v1; fitbull polls the REST reads.
- Handicap-out surfaces to third parties (write-only-by-default) — does not restrict fitbull's own reads.

## Definition of done

- A committed integration note covering base URL, auth, day-1 calls, idempotency, polling, error handling, and quarantine-status handling.

## Verification

N/A in this repo (verified by fitbull's own integration tests); the canary (001) proves the surface is reachable.
