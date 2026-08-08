/**
 * The `/v1` OpenAPI 3.1 document builder — T13.5.
 *
 * DECISIONS #5 locked the mechanism: "hand-written REST /v1 with shared zod
 * schemas, OpenAPI 3.1 generated from those schemas, CI regen-and-diff gate".
 * This module is the generator half; the committed artifact lives at
 * `docs/api/v1/openapi.json` (repo root) and is written by
 * `apps/web/scripts/generate-openapi.ts` (`pnpm gen:openapi`). The CI gate is
 * `tests/unit/api/v1/openapi-spec.test.ts`, which regenerates in memory and
 * diffs against the committed file.
 *
 * ── What is GENERATED vs TRANSCRIBED ──────────────────────────────────────
 * Everything mechanical is imported from the shipped modules so it cannot
 * drift silently:
 *   - the error registry (codes, statuses, titles, default details) comes
 *     from `@/lib/api/problem`'s `PROBLEM_REGISTRY`;
 *   - the request body schema for `POST /v1/rounds` is `z.toJSONSchema` of
 *     the real `v1RoundSubmissionBodySchema`;
 *   - scope names come from `V1_SCOPES`; the stability header from
 *     `problem-response.ts`; query-parameter bounds from the route modules;
 *   - the field-level codes come from the constants the schemas emit.
 * The prose blocks are TRANSCRIBED VERBATIM from the frozen contract
 * (`docs/research/api-platform/plans/005-phase0-contract.md` §2/§5/§6, rev. 6
 * with the D10–D15 amendments). They are contractual text — do not edit them
 * here; a wording change is a contract amendment first.
 *
 * ── Deliberate representation choices ─────────────────────────────────────
 * - **Extensible enums** (`status`, `handicapRevision`, and every other
 *   string union) are represented as `type: string` plus `x-extensible-enum`,
 *   never a closed JSON-Schema `enum`: §4 makes new values in enums
 *   documented as extensible a NON-breaking change, and a closed `enum` would
 *   make every future value a spec violation. The one closed enum is the
 *   problem `code` registry itself, which §1 freezes as closed.
 * - **`x-problem-codes`** on every error response and **`x-problem-registry`**
 *   at the root are machine-readable parity hooks: the unit test cross-checks
 *   them against `PROBLEM_REGISTRY` and the per-route mapper behavior.
 * - **`x-required-scopes` / `x-required-scopes-any-of`** state the D11/D12
 *   scope gates per operation; the security scheme is plain HTTP bearer
 *   because tokens are Supabase-issued (§6) — modelling the OAuth 2.1 flow as
 *   an OpenAPI `oauth2` scheme would document Supabase's token endpoint as if
 *   this spec governed it.
 *
 * The generated `POST /v1/rounds` body schema is the INPUT side of the shared
 * zod schema. Invariants zod enforces with `superRefine`/`preprocess` are not
 * representable in JSON Schema (the teeTime window, holes-required, the 9/18
 * scores rule, offset canonicalization, control-character rejection) — they
 * are documented in the request-body description instead, with their
 * field-level codes.
 */

import { z } from "zod";

import {
  PROBLEM_CODES,
  PROBLEM_CONTENT_TYPE,
  PROBLEM_REGISTRY,
  PROBLEM_TYPE_BASE,
  type ProblemCode,
} from "@/lib/api/problem";
import { SCORE_HOLE_MISMATCH_FIELD_CODE } from "@/lib/api/problem-mapper";
import {
  API_STABILITY_HEADER,
  API_STABILITY_VALUE,
} from "@/app/api/v1/_lib/problem-response";
import { V1_SCOPES } from "@/app/api/v1/_lib/principal";
import {
  TEE_TIME_FIELD_CODE,
  TEE_TIME_MIN_ISO,
} from "@/app/api/v1/_lib/schemas";
import {
  V1_EXTERNAL_ID_FIELD_CODE,
  V1_EXTERNAL_ID_MAX_LENGTH,
  V1_TEE_HOLES_FIELD_CODE,
  v1RoundSubmissionBodySchema,
} from "@/app/api/v1/rounds/submission-schema";
import {
  V1_ROUNDS_DEFAULT_LIMIT,
  V1_ROUNDS_MAX_LIMIT,
} from "@/app/api/v1/rounds/list-rounds";
import {
  MAX_COURSE_SEARCH_LIMIT,
  NUL_IN_QUERY_FIELD_CODE,
} from "@/app/api/v1/courses/route";
import { DEFAULT_COURSE_SEARCH_LIMIT } from "@/server/services/catalog";

/** The canonical base URL (contract §4; the only supported host, §1). */
export const V1_SERVER_URL = "https://api.handicappin.com/api/v1";

/** Where the committed spec lives, relative to the REPO ROOT. */
export const V1_OPENAPI_SPEC_REPO_PATH = "docs/api/v1/openapi.json";

/**
 * `GET /v1/tees`' `courseId` upper bound — `serial` PK, positive 32-bit int.
 * Mirrors the (unexported) `PG_MAX_INT` in `../tees/route.ts`.
 */
const PG_MAX_INT = 2147483647;

/* ────────────────────────────────────────────────────────────────────────────
 * VERBATIM contractual prose (005-phase0-contract.md rev. 6).
 * Transcribed byte-for-byte from the frozen contract, including its inline
 * amendment markers. Editing any of these here without a contract amendment
 * publishes text the contract does not say.
 * ──────────────────────────────────────────────────────────────────────────*/

/** §5 — eventual consistency (verbatim into the POST /rounds description). */
export const EVENTUAL_CONSISTENCY_PROSE =
  '`POST /v1/rounds` returns `201 Created` synchronously. The `handicapIndex` in the response is **provisional**: the authoritative handicap recomputation runs **asynchronously**, after the write commits. Until it completes, the response carries `handicapRevision: "pending"`, and the handicap index returned by `GET /v1/profile` or `GET /v1/rounds` may not yet reflect the round you just submitted. Do not treat any index read within moments of a write as final. `handicapRevision` becomes `"current"` once the authoritative value reflects this round, or `"failed"` if the recomputation was attempted and did not complete (the index is then stale and will not self-correct on its own — surface it as stale rather than as up to date). **Treat this field as extensible: any value you do not recognize means "not current."** To converge, refetch the profile **and** the rounds list together after a submission and on app foreground; typical recomputation latency is documented separately and is not a contractual bound.';

/** §5 — quarantine (verbatim into the POST /rounds description). */
export const QUARANTINE_PROSE =
  'A round submitted through `POST /v1/rounds` while the account is over its free-tier round limit is **accepted and stored**, and the request succeeds with `201 Created` and `"status": "quarantined"` in the response body. A quarantined round is excluded from the handicap computation and from the account\'s round count until the account upgrades, at which point it is unlocked automatically — no resubmission is needed. **Treat `status` as extensible: any value you do not recognize means "not active."** Quarantine is **not an error**: `POST /v1/rounds` never returns `403 Forbidden` because of the round limit, and no `round_limit_reached` error code exists on this endpoint. The only billing-related error on this surface is `plan_required` (`403`), returned when the account has not completed plan selection; the account holder resolves it in the handicappin app.';

/** §2 — the non-escalating `idempotency_conflict` client guidance (verbatim). */
export const IDEMPOTENCY_CONFLICT_PROSE =
  "`409 idempotency_conflict` means this idempotency key already identifies a stored round whose contents differ from what you sent. **The round exists** — do not retry with the same key, and do not treat this as a lost write. If you did not intend to submit different contents, the round was most likely edited in the handicappin app after you created it; treat the stored round as authoritative, stop retrying that key, and if you need its current state, re-read it from `GET /v1/rounds`.";

/** §6 — the auth statement (verbatim into the security scheme description). */
export const AUTH_PROSE =
  "All `/api/v1` endpoints **except `GET /v1/health`** require `Authorization: Bearer <access token>`. Health is deliberately unauthenticated — it is the ingress canary's probe, the canary cannot hold a credential, and an authenticated probe cannot reproduce the cookie-less edge-block failure it exists to detect (rationale recorded in the route header; in the OpenAPI spec the operation carries `security: []`). *[Amended 2026-08-08 — D10.]* For every other endpoint the token is a Supabase-issued access token obtained through the handicappin OAuth 2.1 authorization flow (authorization code + PKCE, consent at the app-hosted `/oauth/consent` page; refresh via `POST /auth/v1/oauth/token` with client authentication). Tokens issued to an OAuth client carry a `client_id` claim and a `scope` claim; the scope vocabulary is `rounds:read` and `rounds:write` (both stamped on every OAuth token today). `POST /v1/rounds` requires `rounds:write`; `GET /v1/rounds` requires `rounds:read` or `rounds:write`; `GET /v1/courses` and `GET /v1/tees` require authentication only — no scope, no plan — and will never gain a gate within v1. *[Amended 2026-08-08 — D11/D12.]* `/api/v1` is the only application surface that accepts such tokens: the application's own first-party surfaces (for example its tRPC endpoint) reject them outright. Note that this is not a claim of total network isolation — the underlying Supabase database API remains reachable with the same token, constrained by row-level security policies rather than by this API. Requests without a valid token receive `401` (`unauthorized`) — including tokens that have been revoked, since validation is performed server-side against the authorization server on every request, and including an OAuth-client token that arrives without a `scope` claim. An operation a token's scope does not permit receives `403` (`forbidden`). Access tokens contain no billing information. Do not request the `openid` scope.";

/* ────────────────────────────────────────────────────────────────────────────
 * Small building blocks
 * ──────────────────────────────────────────────────────────────────────────*/

type SpecObject = Record<string, unknown>;

const STABILITY_HEADER_REF = {
  $ref: "#/components/headers/XApiStability",
} as const;

/** The field-level codes (§1's append-only namespace) the surface emits today. */
const KNOWN_FIELD_CODES = [
  TEE_TIME_FIELD_CODE,
  V1_EXTERNAL_ID_FIELD_CODE,
  V1_TEE_HOLES_FIELD_CODE,
  NUL_IN_QUERY_FIELD_CODE,
  SCORE_HOLE_MISMATCH_FIELD_CODE,
] as const;

/** `type: string` + `x-extensible-enum` — never a closed enum (§4). */
function extensibleEnum(
  values: readonly string[],
  description: string,
  extra: SpecObject = {}
): SpecObject {
  return {
    type: "string",
    "x-extensible-enum": [...values],
    description,
    ...extra,
  };
}

function codeLine(code: ProblemCode): string {
  const def = PROBLEM_REGISTRY[code];
  return `\`${code}\` — ${def.title}. ${def.detail}`;
}

/**
 * An error response: `application/problem+json`, the stability header, and
 * the closed set of codes this operation can emit at this status.
 */
function problemSpecResponse(
  codes: readonly ProblemCode[],
  options: { prose?: string; headers?: SpecObject } = {}
): SpecObject {
  const lines = codes.map(codeLine).join("\n\n");
  return {
    description: options.prose ? `${lines}\n\n${options.prose}` : lines,
    headers: {
      [API_STABILITY_HEADER]: STABILITY_HEADER_REF,
      ...(options.headers ?? {}),
    },
    content: {
      [PROBLEM_CONTENT_TYPE]: {
        schema: { $ref: "#/components/schemas/Problem" },
      },
    },
    "x-problem-codes": [...codes],
  };
}

/** JSON success response with the mandatory stability header. */
function jsonSpecResponse(
  description: string,
  schemaRef: string,
  extraHeaders: SpecObject = {}
): SpecObject {
  return {
    description,
    headers: {
      [API_STABILITY_HEADER]: STABILITY_HEADER_REF,
      ...extraHeaders,
    },
    content: {
      "application/json": { schema: { $ref: schemaRef } },
    },
  };
}

/** The three responses every operation carries (429 / 500 / 503, §3 + §1). */
function universalErrorResponses(): SpecObject {
  return {
    "429": { $ref: "#/components/responses/RateLimited" },
    "500": { $ref: "#/components/responses/InternalError" },
    "503": { $ref: "#/components/responses/ServiceUnavailable" },
  };
}

/* ────────────────────────────────────────────────────────────────────────────
 * Schemas
 * ──────────────────────────────────────────────────────────────────────────*/

/** `POST /v1/rounds` request body — GENERATED from the shipped zod schema. */
function roundSubmissionSchema(): SpecObject {
  const generated = z.toJSONSchema(v1RoundSubmissionBodySchema, {
    io: "input",
    target: "draft-2020-12",
    unrepresentable: "any",
  }) as SpecObject;
  // The document declares OpenAPI 3.1's default dialect; a nested `$schema`
  // is redundant and some tooling chokes on it inside `components`.
  delete generated.$schema;

  return {
    description: [
      "The `POST /v1/rounds` request body — the shared scorecard schema composed with the `/v1`-only additions. Generated from the shipped zod schema (`v1RoundSubmissionBodySchema`); invariants zod enforces beyond JSON Schema are listed here and rejected as `422 validation_failed` with the named field-level code in `errors[]`:",
      `- \`teeTime\` must lie in the window \`${TEE_TIME_MIN_ISO}\` … now + 24 hours (D5; field code \`${TEE_TIME_FIELD_CODE}\`). An offset-bearing ISO 8601 date-time (e.g. \`2026-07-29T16:32:00+02:00\`) is accepted and canonicalized to its UTC instant before validation; a date-time with no zone designator at all is rejected.`,
      `- \`teePlayed.holes\` is REQUIRED on \`/v1\` — all 18 holes with \`par\`, \`hcp\` and \`distance\` (field code \`${V1_TEE_HOLES_FIELD_CODE}\`); the server derives per-hole handicap strokes from them, so client-supplied \`hcpStrokes\` values are ignored and re-derived.`,
      `- \`externalId\` is the optional idempotency key (§2): opaque, at most ${V1_EXTERNAL_ID_MAX_LENGTH} characters, no control characters (field code \`${V1_EXTERNAL_ID_FIELD_CODE}\`). It is matched EXACTLY — the server never trims or case-folds it.`,
      "- `scores` must contain exactly 9 or 18 entries; `nineHoleSection` is required for 9-hole rounds and forbidden for 18-hole rounds. Scores bind to holes by ARRAY POSITION within the played section, not by hole number.",
      "- `userId` must equal the authenticated principal's own user id; a mismatch is `403 forbidden`.",
    ].join("\n"),
    ...generated,
  };
}

function problemSchema(): SpecObject {
  return {
    type: "object",
    description: `RFC 9457 problem document — the envelope of every application-emitted non-2xx response (media type \`${PROBLEM_CONTENT_TYPE}\`). The \`code\` registry is CLOSED and APPEND-ONLY: new codes may be added (non-breaking); existing codes are never repurposed or removed within v1. \`detail\` never contains internal identifiers, stack traces, or infrastructure reasons.`,
    properties: {
      type: {
        type: "string",
        format: "uri",
        description: `\`${PROBLEM_TYPE_BASE}/{code}\` — a stable identifier, not required to dereference. \`about:blank\` is never used.`,
      },
      title: {
        type: "string",
        description:
          "Short, human-readable, fixed per code. Changing it is non-breaking; keying on it is unsupported — switch on `code`.",
      },
      status: {
        type: "integer",
        description: "Mirrors the HTTP status code.",
      },
      code: {
        type: "string",
        enum: [...PROBLEM_CODES],
        description:
          "REQUIRED extension member — the machine key clients switch on, from the closed registry (see `x-problem-registry` at the document root for each code's status and title).",
      },
      detail: {
        type: "string",
        description: "Human-readable specifics. Safe to show a developer.",
      },
      instance: {
        type: "string",
        description: "Request-scoped id for support correlation.",
      },
      errors: {
        type: "array",
        items: { $ref: "#/components/schemas/ProblemFieldError" },
        description: "Present on `validation_failed` only.",
      },
      existingRoundId: {
        type: "integer",
        description:
          "Present on `duplicate_round` only: the id of the already-stored round. `idempotency_conflict` deliberately carries no round id — a key match means the client already knows which round it addressed.",
      },
    },
    required: ["type", "title", "status", "code"],
  };
}

function problemFieldErrorSchema(): SpecObject {
  return {
    type: "object",
    description: `A field-level item inside \`validation_failed\`'s \`errors[]\`. \`code\` belongs to a separate, append-only FIELD-code namespace (distinct from the problem \`code\` registry). Codes emitted today: ${KNOWN_FIELD_CODES.map(
      (code) => `\`${code}\``
    ).join(
      ", "
    )}; any other value is the underlying zod issue code. Treat the namespace as extensible.`,
    properties: {
      path: {
        type: "string",
        description:
          "Dotted path into the request body, e.g. `scores.3.putts`; `(root)` for a document-level issue.",
      },
      code: { type: "string", description: "Append-only field-level code." },
      message: { type: "string", description: "Human-readable message." },
    },
    required: ["path", "code", "message"],
  };
}

/** The frozen `/v1` round resource (serializers/round.ts, §5). */
function roundResourceSchema(): SpecObject {
  return {
    type: "object",
    description:
      "The `/v1` round resource. The `201` from `POST /v1/rounds`, its `200` idempotent replay, and every entry of `GET /v1/rounds` are this identical shape (§2 rule 2, §5). Per the tolerant-reader requirement, ignore fields you do not recognize — new fields are added without a version bump.",
    properties: {
      id: {
        type: "integer",
        description: "Server-assigned round id. Stable, the resource's identity.",
      },
      externalId: {
        type: ["string", "null"],
        description:
          "The client-supplied idempotency key (§2), or null if none was sent.",
      },
      status: extensibleEnum(
        ["active", "quarantined"],
        'Round state (§5). `"quarantined"` = stored but excluded from the handicap computation and from the account\'s round count until the account upgrades. EXTENSIBLE: treat any value you do not recognize as "not active".'
      ),
      handicapIndex: {
        type: "number",
        description:
          "The handicap index as of this round — **provisional** (§5). The authoritative recomputation runs asynchronously after the write commits.",
      },
      handicapRevision: extensibleEnum(
        ["pending", "current", "failed"],
        'Recomputation state of `handicapIndex` (§5). `"pending"` = the authoritative recomputation has not completed and the index is provisional; `"current"` = it has completed and the index reflects this round; `"failed"` = it was attempted and did not complete (the index is stale and will not self-correct without operator action). EXTENSIBLE: treat any value you do not recognize as "not current". The current build emits `"pending"` unconditionally — detection of `"current"`/`"failed"` is reserved and not yet wired.'
      ),
      courseId: { type: "integer" },
      teeId: { type: "integer" },
      teeTime: {
        type: "string",
        format: "date-time",
        description: "ISO 8601 UTC instant (trailing `Z`).",
      },
      nineHoleSection: {
        type: ["string", "null"],
        "x-extensible-enum": ["front", "back"],
        description:
          "Which 9-hole section was played; null for an 18-hole round.",
      },
      notes: { type: ["string", "null"] },
      holesPlayed: { type: "integer", description: "9 or 18." },
      totalStrokes: { type: "integer" },
      parPlayed: { type: "integer" },
      adjustedGrossScore: { type: "integer" },
      adjustedPlayedScore: { type: "integer" },
      courseHandicap: { type: "integer" },
      scoreDifferential: { type: "number" },
      courseRating: {
        type: "number",
        description:
          "Course rating LOCKED AT PLAY TIME — may differ from the tee's current rating.",
      },
      slopeRating: {
        type: "number",
        description: "Slope rating locked at play time. Same caveat.",
      },
      createdAt: {
        type: "string",
        format: "date-time",
        description: "ISO 8601 UTC instant.",
      },
      updatedAt: {
        type: "string",
        format: "date-time",
        description: "ISO 8601 UTC instant.",
      },
    },
    required: [
      "id",
      "externalId",
      "status",
      "handicapIndex",
      "handicapRevision",
      "courseId",
      "teeId",
      "teeTime",
      "nineHoleSection",
      "notes",
      "holesPlayed",
      "totalStrokes",
      "parPlayed",
      "adjustedGrossScore",
      "adjustedPlayedScore",
      "courseHandicap",
      "scoreDifferential",
      "courseRating",
      "slopeRating",
      "createdAt",
      "updatedAt",
    ],
  };
}

function roundsPageSchema(): SpecObject {
  return {
    type: "object",
    description:
      "One page of the principal's rounds, newest tee time first (`teeTime DESC, id DESC`). Quarantined rounds are NOT filtered out — a round the API accepted with a 201 stays visible, distinguished by `status`.",
    properties: {
      data: {
        type: "array",
        items: { $ref: "#/components/schemas/RoundResource" },
      },
      pagination: {
        type: "object",
        properties: {
          limit: { type: "integer" },
          offset: { type: "integer" },
          count: {
            type: "integer",
            description: "Entries in THIS page.",
          },
          hasMore: {
            type: "boolean",
            description:
              "Whether at least one more row exists after this page. There is no `total` — page until `hasMore` is false.",
          },
        },
        required: ["limit", "offset", "count", "hasMore"],
      },
    },
    required: ["data", "pagination"],
  };
}

function coursesResponseSchema(): SpecObject {
  return {
    type: "object",
    description: "Course search results, wrapped in an object so pagination metadata can be added later without a breaking change.",
    properties: {
      courses: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "integer" },
            name: { type: "string" },
            country: { type: "string" },
            city: { type: "string" },
            website: {
              type: ["string", "null"],
              description: "Always present; null when the course has no website on file.",
            },
          },
          required: ["id", "name", "country", "city", "website"],
        },
      },
    },
    required: ["courses"],
  };
}

function teesResponseSchema(): SpecObject {
  return {
    type: "object",
    description: "The playable tees of one catalog course.",
    properties: {
      tees: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "integer" },
            courseId: { type: "integer" },
            name: { type: "string" },
            gender: extensibleEnum(
              ["mens", "ladies"],
              "Tee gender designation. Treat unknown values tolerantly."
            ),
            distanceMeasurement: extensibleEnum(
              ["meters", "yards"],
              "Unit of every distance field on this tee and its holes."
            ),
            courseRating18: { type: "number" },
            slopeRating18: { type: "number" },
            courseRatingFront9: { type: "number" },
            slopeRatingFront9: { type: "number" },
            courseRatingBack9: {
              type: "number",
              description:
                "Nine-hole ratings are included because a 9-hole round is written against the front-or-back rating, not the 18-hole one.",
            },
            slopeRatingBack9: { type: "number" },
            outPar: { type: "integer" },
            inPar: { type: "integer" },
            totalPar: { type: "integer" },
            outDistance: { type: "number" },
            inDistance: { type: "number" },
            totalDistance: { type: "number" },
            holes: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  holeNumber: {
                    type: "integer",
                    description:
                      "1–18. Within a tee, this is the hole's identity.",
                  },
                  par: { type: "integer" },
                  hcp: {
                    type: "integer",
                    description: "Stroke index, 1–18.",
                  },
                  distance: { type: "number" },
                },
                required: ["holeNumber", "par", "hcp", "distance"],
              },
            },
          },
          required: [
            "id",
            "courseId",
            "name",
            "gender",
            "distanceMeasurement",
            "courseRating18",
            "slopeRating18",
            "courseRatingFront9",
            "slopeRatingFront9",
            "courseRatingBack9",
            "slopeRatingBack9",
            "outPar",
            "inPar",
            "totalPar",
            "outDistance",
            "inDistance",
            "totalDistance",
            "holes",
          ],
        },
      },
    },
    required: ["tees"],
  };
}

function healthResponseSchema(): SpecObject {
  return {
    type: "object",
    description:
      "A fixed literal — no timestamp, no version, no dependency roll-up. It exists so the ingress canary can tell a real application JSON answer apart from an HTML challenge interstitial.",
    properties: {
      status: { type: "string", enum: ["ok"] },
    },
    required: ["status"],
  };
}

/* ────────────────────────────────────────────────────────────────────────────
 * Info / components
 * ──────────────────────────────────────────────────────────────────────────*/

function infoDescription(): string {
  return [
    `**Internal / unstable surface.** This API is internal until a second consumer exists. Every application-emitted response carries \`${API_STABILITY_HEADER}: ${API_STABILITY_VALUE}\` (contract §4). While internal, breaking changes are permitted only with same-owner coordination and a dated changelog entry.`,
    "",
    "**Tolerant reader requirement (contract §4):** clients MUST ignore unknown response fields. String fields annotated `x-extensible-enum` are extensible enums: clients must tolerate values not listed, applying the fallback reading given in the field's description. New endpoints, new optional request fields, new response fields, and new error codes are added without a version bump.",
    "",
    "**Non-contractual responses (contract §1):** clients must tolerate a non-`application/problem+json` `404`/`405`/`429`/`5xx` emitted by the framework and infrastructure layers — the router's own 404 for an unmatched path and 405 for an unsupported method, the platform WAF's 429, and platform 5xx. The contractual error envelope covers application-emitted responses only.",
    "",
    `**Errors** are RFC 9457 \`${PROBLEM_CONTENT_TYPE}\` documents with a REQUIRED \`code\` member from a closed, append-only registry — see the \`Problem\` schema and \`x-problem-registry\`. \`validation_failed\` responses carry field-level \`errors[]\` whose \`code\` values form a separate append-only namespace (currently: ${KNOWN_FIELD_CODES.map(
      (code) => `\`${code}\``
    ).join(", ")}).`,
    "",
    "**Rate limiting (contract §3):** every route is rate-limited fail-closed, per principal — `client:{client_id}:user:{sub}` for OAuth-client tokens, `user:{sub}` for first-party tokens, and `ip:{ip}` for pre-auth/invalid-token traffic (a dedicated pre-auth budget, D15). Budget exhaustion is `429 rate_limited` with `Retry-After` and the `X-RateLimit-Limit` / `X-RateLimit-Remaining` / `X-RateLimit-Reset` headers; limiter-infrastructure unavailability is `503 service_unavailable` with `Retry-After` (fail-closed — the surface refuses rather than running unmetered). Numeric budgets are operational values, not contractual bounds.",
    "",
    `**Base URL:** \`${V1_SERVER_URL}\` is the only supported base (contract §1). \`/api/v1\` on any other host is unsupported and may be blocked without notice.`,
  ].join("\n");
}

/* ────────────────────────────────────────────────────────────────────────────
 * Paths
 * ──────────────────────────────────────────────────────────────────────────*/

function healthPath(): SpecObject {
  return {
    get: {
      operationId: "getHealth",
      tags: ["health"],
      summary: "Liveness probe for the /v1 application layer",
      description:
        "Answers exactly one question: did a request from outside the network reach the application layer and get an application-generated JSON answer back. It is NOT a dependency health check — it probes no database and no auth service. **Deliberately unauthenticated** (D10): it is the ingress canary's probe; the canary cannot hold a credential, and an authenticated probe cannot reproduce the cookie-less edge-block failure this route exists to detect. It is the sole unauthenticated endpoint. Rate-limited from the pre-auth (IP-keyed) budget; the limiter is fail-closed, so limiter unavailability answers `503` here too.",
      security: [],
      responses: {
        "200": jsonSpecResponse(
          "The application layer answered.",
          "#/components/schemas/HealthResponse",
          {
            "Cache-Control": {
              description:
                "`no-store` — a cached 200 would report the health of a cache, not of the running deployment.",
              schema: { type: "string" },
            },
          }
        ),
        ...universalErrorResponses(),
      },
    },
  };
}

function coursesPath(): SpecObject {
  return {
    get: {
      operationId: "searchCourses",
      tags: ["catalog"],
      summary: "Search the course catalog by name",
      description:
        "The first half of the resolve a client performs before writing a round: a course name yields a `courseId`, and `GET /v1/tees?courseId=…` turns that into the `teeId` the write needs. Case-insensitive substring match on the course name; the term is trimmed before matching. Only approved catalog entries are returned. **Authentication only — no scope and no plan gate, permanently** (D12): adding either later would be a breaking change. There is no browse endpoint: `q` is required, and a client needing more than the `limit` cap should search more specifically.",
      "x-required-scopes": [],
      parameters: [
        {
          name: "q",
          in: "query",
          required: true,
          description: `Search term, 1–100 characters after trimming. Must not contain a NUL byte (field code \`${NUL_IN_QUERY_FIELD_CODE}\`).`,
          schema: { type: "string", minLength: 1, maxLength: 100 },
        },
        {
          name: "limit",
          in: "query",
          required: false,
          description: "Maximum matches to return.",
          schema: {
            type: "integer",
            minimum: 1,
            maximum: MAX_COURSE_SEARCH_LIMIT,
            default: DEFAULT_COURSE_SEARCH_LIMIT,
          },
        },
      ],
      responses: {
        "200": jsonSpecResponse(
          "Matching approved catalog courses. An empty `courses` array is a valid result — no match is not an error.",
          "#/components/schemas/CoursesResponse"
        ),
        "401": { $ref: "#/components/responses/Unauthorized" },
        "422": problemSpecResponse(["validation_failed"]),
        ...universalErrorResponses(),
      },
    },
  };
}

function teesPath(): SpecObject {
  return {
    get: {
      operationId: "listTees",
      tags: ["catalog"],
      summary: "List the playable tees of one catalog course",
      description:
        "The second half of the resolve: turns a `courseId` into the `teeId` a round write references, including per-hole par, stroke index (`hcp`) and distance — the hole data `POST /v1/rounds` requires in `teePlayed.holes`. **Authentication only — no scope and no plan gate, permanently** (D12). A course that exists but is not approved is indistinguishable from one that does not exist — both are `422 course_not_found` (no existence oracle). A `200` with an empty `tees` array means the course exists but has no approved tees yet — a different condition from an unknown course, deliberately distinguishable.",
      "x-required-scopes": [],
      parameters: [
        {
          name: "courseId",
          in: "query",
          required: true,
          description: "A course id obtained from `GET /v1/courses`.",
          schema: { type: "integer", minimum: 1, maximum: PG_MAX_INT },
        },
      ],
      responses: {
        "200": jsonSpecResponse(
          "The course's approved tees (possibly empty).",
          "#/components/schemas/TeesResponse"
        ),
        "401": { $ref: "#/components/responses/Unauthorized" },
        "422": problemSpecResponse(["course_not_found", "validation_failed"], {
          prose:
            "`course_not_found` (D14): the referenced course is not in the catalog — never `not_found`, and never an empty list. The remedy is to re-resolve the course via `GET /v1/courses`.",
        }),
        ...universalErrorResponses(),
      },
    },
  };
}

function roundsPath(): SpecObject {
  return {
    get: {
      operationId: "listRounds",
      tags: ["rounds"],
      summary: "List the principal's own rounds (write reconciliation)",
      description:
        "Exists for WRITE RECONCILIATION, not display: it answers \"did the round I sent get stored, and what happened to it\" — hence the `externalId` filter and the `status` / `handicapRevision` fields on every entry, and no per-hole scores. Returns only the authenticated principal's rounds, ordered `teeTime DESC, id DESC`. Quarantined rounds are included, distinguished by `status`. Requires `rounds:read` OR `rounds:write` (D11) and a completed plan selection (`403 plan_required` otherwise — D12 keeps the entitlement gate on this read). Unknown query parameters are IGNORED; the three below each may appear at most once.",
      "x-required-scopes-any-of": [V1_SCOPES.roundsRead, V1_SCOPES.roundsWrite],
      parameters: [
        {
          name: "externalId",
          in: "query",
          required: false,
          description:
            "Exact match on the client's own idempotency key (§2). Deliberately unconstrained in format — a read filter stricter than the write path would make a stored round unqueryable by the key it was stored under.",
          schema: { type: "string", minLength: 1 },
        },
        {
          name: "limit",
          in: "query",
          required: false,
          description: "Page size.",
          schema: {
            type: "integer",
            minimum: 1,
            maximum: V1_ROUNDS_MAX_LIMIT,
            default: V1_ROUNDS_DEFAULT_LIMIT,
          },
        },
        {
          name: "offset",
          in: "query",
          required: false,
          description: "Rows to skip (offset pagination).",
          schema: { type: "integer", minimum: 0, default: 0 },
        },
      ],
      responses: {
        "200": jsonSpecResponse(
          "One page of the principal's rounds.",
          "#/components/schemas/RoundsPage"
        ),
        "401": { $ref: "#/components/responses/Unauthorized" },
        "403": problemSpecResponse(["forbidden", "plan_required"], {
          prose:
            "`forbidden`: the token's scope permits neither `rounds:read` nor `rounds:write`. `plan_required`: the account has not completed plan selection; the account holder resolves it in the handicappin app.",
        }),
        "422": problemSpecResponse(["validation_failed"]),
        ...universalErrorResponses(),
      },
    },
    post: {
      operationId: "createRound",
      tags: ["rounds"],
      summary: "Submit a round",
      description: [
        "Requires `rounds:write`. Returns `201 Created` **synchronously** — never `202`, never `200` on a first write, and never `403` for an over-limit round.",
        "",
        `**Idempotency (§2 — externalId-primary, replay-by-lookup).** Supply your own opaque \`externalId\` (e.g. your round UUID) with every submission. Retrying the identical body with the same key returns \`200\` with the stored round — reflecting CURRENT server state (its \`status\` may have become \`"quarantined"\`; its \`handicapRevision\` may have advanced) — in the identical shape as the 201. The same key with a DIFFERENT body is \`409 idempotency_conflict\`; a natural-key collision (same user, tee, tee time and nine-hole section) without a matching key is \`409 duplicate_round\` carrying \`existingRoundId\`. Without an \`externalId\` there is no replay: an exact duplicate is always \`409 duplicate_round\`.`,
        "",
        `**Eventual consistency (contract §5):** ${EVENTUAL_CONSISTENCY_PROSE}`,
        "",
        `**Quarantine (contract §5):** ${QUARANTINE_PROSE}`,
      ].join("\n"),
      "x-required-scopes": [V1_SCOPES.roundsWrite],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/RoundSubmission" },
          },
        },
      },
      responses: {
        "201": jsonSpecResponse(
          'The round was stored. `handicapIndex` is provisional (`handicapRevision: "pending"`); an over-limit round is stored with `status: "quarantined"` — that is a success, not an error.',
          "#/components/schemas/RoundResource"
        ),
        "200": jsonSpecResponse(
          "Idempotent replay (§2 rule 2): an existing round matched `(userId, externalId)` and the submitted body is identical. The body is the stored round in the identical shape as the 201, reflecting current server state. Replay never re-runs limit checks and never mutates.",
          "#/components/schemas/RoundResource"
        ),
        "400": problemSpecResponse(["malformed_request"], {
          prose:
            "Wrong or missing `Content-Type`, or a body that is not parseable JSON. (Deliberately 400, not 415 — the registry is closed.)",
        }),
        "401": { $ref: "#/components/responses/Unauthorized" },
        "403": problemSpecResponse(["forbidden", "plan_required"], {
          prose:
            "`forbidden`: the token lacks `rounds:write`, or the body's `userId` is not the authenticated user's own id. `plan_required`: the account has not completed plan selection; the account holder resolves it in the handicappin app. There is NO `403` for an over-limit round.",
        }),
        "409": problemSpecResponse(["idempotency_conflict", "duplicate_round"], {
          prose: `${IDEMPOTENCY_CONFLICT_PROSE}\n\n\`duplicate_round\` carries \`existingRoundId\` — a round with the same natural key (user, tee, tee time, nine-hole section) already exists and no \`externalId\` matched; the client decides whether it was a retry or a second genuine round entered twice.`,
        }),
        "422": problemSpecResponse(["validation_failed", "course_not_found"], {
          prose: `\`validation_failed\` carries field-level \`errors[]\` (codes include \`${TEE_TIME_FIELD_CODE}\`, \`${V1_TEE_HOLES_FIELD_CODE}\`, \`${V1_EXTERNAL_ID_FIELD_CODE}\`, \`${SCORE_HOLE_MISMATCH_FIELD_CODE}\`). \`course_not_found\`: the referenced tee did not resolve to an approved, non-archived catalog row — re-resolve via \`GET /v1/courses\` and \`GET /v1/tees\`.`,
        }),
        ...universalErrorResponses(),
      },
    },
  };
}

/* ────────────────────────────────────────────────────────────────────────────
 * The document
 * ──────────────────────────────────────────────────────────────────────────*/

/** Build the complete `/v1` OpenAPI 3.1 document. Pure and deterministic. */
export function buildV1OpenApiDocument(): SpecObject {
  return {
    openapi: "3.1.0",
    info: {
      title: "handicappin API",
      version: "1.0.0",
      description: infoDescription(),
    },
    servers: [
      {
        url: V1_SERVER_URL,
        description:
          "The only supported base host (contract §1). `/api/v1` on any other host is unsupported and may be blocked without notice.",
      },
    ],
    security: [{ bearerAuth: [] }],
    tags: [
      { name: "health", description: "Liveness." },
      {
        name: "catalog",
        description:
          "Reference data — identical for every authenticated principal; authentication-only, permanently (D12).",
      },
      { name: "rounds", description: "The principal's own rounds." },
    ],
    paths: {
      "/health": healthPath(),
      "/courses": coursesPath(),
      "/tees": teesPath(),
      "/rounds": roundsPath(),
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: AUTH_PROSE,
        },
      },
      headers: {
        XApiStability: {
          description:
            "Stability marker (contract §4): the surface is internal/unstable until a second consumer exists. Present on every application-emitted response.",
          schema: { type: "string", enum: [API_STABILITY_VALUE] },
        },
        RetryAfter: {
          description:
            "Seconds to wait before retrying. On a 503 (fail-closed limiter) this is a fixed backoff; on a 429 it is derived from the window reset.",
          schema: { type: "integer", minimum: 1 },
        },
        XRateLimitLimit: {
          description: "The budget for the current window.",
          schema: { type: "integer" },
        },
        XRateLimitRemaining: {
          description: "Requests left in the current window.",
          schema: { type: "integer" },
        },
        XRateLimitReset: {
          description: "Window reset time, unix SECONDS.",
          schema: { type: "integer" },
        },
      },
      responses: {
        Unauthorized: problemSpecResponse(["unauthorized"], {
          prose:
            "Missing, invalid, expired or REVOKED Bearer token (validation is server-side against the authorization server on every request), or an OAuth-client token that arrived without a `scope` claim.",
        }),
        RateLimited: problemSpecResponse(["rate_limited"], {
          prose:
            "The request budget for this principal (or, pre-auth, this IP) is exhausted. Honor `Retry-After`. The `X-RateLimit-*` trio is populated from the limiter result and may be omitted when it is unavailable.",
          headers: {
            "Retry-After": { $ref: "#/components/headers/RetryAfter" },
            "X-RateLimit-Limit": {
              $ref: "#/components/headers/XRateLimitLimit",
            },
            "X-RateLimit-Remaining": {
              $ref: "#/components/headers/XRateLimitRemaining",
            },
            "X-RateLimit-Reset": {
              $ref: "#/components/headers/XRateLimitReset",
            },
          },
        }),
        InternalError: problemSpecResponse(["internal_error"], {
          prose: "Unexpected failure. No internal detail is leaked.",
        }),
        ServiceUnavailable: problemSpecResponse(["service_unavailable"], {
          prose:
            "A dependency is unavailable — including the FAIL-CLOSED rate limiter (§3): when the limiter's infrastructure is unavailable the surface refuses rather than running unmetered. The internal reason is never disclosed. Honor `Retry-After`.",
          headers: {
            "Retry-After": { $ref: "#/components/headers/RetryAfter" },
          },
        }),
      },
      schemas: {
        Problem: problemSchema(),
        ProblemFieldError: problemFieldErrorSchema(),
        HealthResponse: healthResponseSchema(),
        CoursesResponse: coursesResponseSchema(),
        TeesResponse: teesResponseSchema(),
        RoundResource: roundResourceSchema(),
        RoundsPage: roundsPageSchema(),
        RoundSubmission: roundSubmissionSchema(),
      },
    },
    /**
     * Machine-readable mirror of `PROBLEM_REGISTRY` (§1) — the parity test
     * cross-checks it against the shipped module in both directions.
     */
    "x-problem-registry": Object.fromEntries(
      PROBLEM_CODES.map((code) => [
        code,
        {
          status: PROBLEM_REGISTRY[code].status,
          title: PROBLEM_REGISTRY[code].title,
          defaultDetail: PROBLEM_REGISTRY[code].detail,
        },
      ])
    ),
  };
}

/** Render the document exactly as the committed file stores it. */
export function renderV1OpenApiJson(): string {
  return `${JSON.stringify(buildV1OpenApiDocument(), null, 2)}\n`;
}
