/**
 * The OpenAPI regen-and-diff CI gate (T13.5; DECISIONS #5) plus targeted
 * spec ↔ handler parity assertions.
 *
 * The committed spec is `docs/api/v1/openapi.json` at the REPO ROOT, written
 * by `pnpm gen:openapi` (`apps/web/scripts/generate-openapi.ts`). This suite:
 *
 *  1. **Regen-and-diff** — rebuilds the document in memory from the shipped
 *     modules and requires the committed file to be deep-equal. Any change to
 *     the `/v1` surface (registry, schemas, scopes, prose) fails here until
 *     `pnpm gen:openapi` is re-run — that IS the gate.
 *  2. **Structural OpenAPI 3.1 validity** — version string, the five
 *     operations, every `$ref` resolves, global bearer security with health's
 *     `security: []` override (D10).
 *  3. **Parity that survives a wrong regen** — the committed file is compared
 *     against the SHIPPED modules directly (registry codes both directions,
 *     scope constants, the serializer's runtime output keys), so a hand-edit
 *     of the spec that also updated the generator would still be caught where
 *     it contradicts the handlers.
 *  4. **Contractual prose sentinels** — hard-coded here, independently of the
 *     generator's constants, so the verbatim §2/§5/§6 blocks cannot be
 *     dropped by editing generator and spec together.
 *
 * What this suite CANNOT catch: behavior the spec describes only in prose
 * (status-code choices inside a handler branch, idempotency semantics); those
 * stay covered by the route unit/integration suites.
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "vitest";

import {
  buildV1OpenApiDocument,
  V1_OPENAPI_SPEC_REPO_PATH,
  V1_SERVER_URL,
} from "@/app/api/v1/_lib/openapi";
import { PROBLEM_CODES, PROBLEM_REGISTRY } from "@/lib/api/problem";
import { SCORE_HOLE_MISMATCH_FIELD_CODE } from "@/lib/api/problem-mapper";
import {
  API_STABILITY_HEADER,
  API_STABILITY_VALUE,
} from "@/app/api/v1/_lib/problem-response";
import { V1_SCOPES } from "@/app/api/v1/_lib/principal";
import { TEE_TIME_FIELD_CODE } from "@/app/api/v1/_lib/schemas";
import {
  V1_EXTERNAL_ID_FIELD_CODE,
  V1_TEE_HOLES_FIELD_CODE,
} from "@/app/api/v1/rounds/submission-schema";
import { NUL_IN_QUERY_FIELD_CODE } from "@/app/api/v1/courses/route";
import {
  serializeV1Round,
  V1_HANDICAP_REVISION_PENDING,
  v1RoundStatus,
  type V1RoundSource,
} from "@/app/api/v1/_lib/serializers/round";

const REPO_ROOT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../../.."
);
const SPEC_PATH = resolve(REPO_ROOT, V1_OPENAPI_SPEC_REPO_PATH);

type Spec = Record<string, unknown>;

const committedRaw = readFileSync(SPEC_PATH, "utf8");
const committed = JSON.parse(committedRaw) as Spec;

/** Follow a `#/…` JSON pointer within the committed document. */
function resolvePointer(ref: string): unknown {
  expect(ref.startsWith("#/"), `external $ref not allowed: ${ref}`).toBe(true);
  let current: unknown = committed;
  for (const segment of ref.slice(2).split("/")) {
    const key = segment.replace(/~1/g, "/").replace(/~0/g, "~");
    current = (current as Record<string, unknown> | undefined)?.[key];
  }
  return current;
}

interface Operation {
  path: string;
  method: string;
  op: Record<string, unknown>;
}

function operations(): Operation[] {
  const paths = committed.paths as Record<string, Record<string, unknown>>;
  const out: Operation[] = [];
  for (const [path, item] of Object.entries(paths)) {
    for (const method of ["get", "post", "put", "patch", "delete"]) {
      const op = item[method];
      if (op) out.push({ path, method, op: op as Record<string, unknown> });
    }
  }
  return out;
}

/** A response object with any `$ref` (response-level) resolved. */
function resolvedResponse(value: unknown): Record<string, unknown> {
  const response = value as Record<string, unknown>;
  if (typeof response.$ref === "string") {
    return resolvedResponse(resolvePointer(response.$ref));
  }
  return response;
}

describe("regen-and-diff gate", () => {
  test("committed spec matches a fresh regeneration — if this fails, run `pnpm gen:openapi` and commit the result", () => {
    // Round-trip through JSON so `undefined`-valued members and class
    // instances cannot hide a difference the file could never represent.
    const regenerated = JSON.parse(
      JSON.stringify(buildV1OpenApiDocument())
    ) as Spec;
    expect(
      committed,
      "docs/api/v1/openapi.json is stale — run `pnpm gen:openapi` (apps/web) and commit the diff"
    ).toEqual(regenerated);
  });

  test("committed file ends with a single trailing newline", () => {
    expect(committedRaw.endsWith("}\n")).toBe(true);
  });
});

describe("structural OpenAPI 3.1 validity", () => {
  test("declares OpenAPI 3.1 with title and version", () => {
    expect(committed.openapi).toBe("3.1.0");
    const info = committed.info as Record<string, unknown>;
    expect(typeof info.title).toBe("string");
    expect(typeof info.version).toBe("string");
    expect(typeof info.description).toBe("string");
  });

  test("exactly the five shipped day-one operations (D9)", () => {
    const found = operations().map(({ method, path }) => `${method} ${path}`);
    expect(found.sort()).toEqual(
      [
        "get /health",
        "get /courses",
        "get /tees",
        "get /rounds",
        "post /rounds",
      ].sort()
    );
  });

  test("single server: the canonical base URL (§1/§4)", () => {
    const servers = committed.servers as { url: string }[];
    expect(servers).toHaveLength(1);
    expect(servers[0]?.url).toBe(V1_SERVER_URL);
    expect(servers[0]?.url).toBe("https://api.handicappin.com/api/v1");
  });

  test("every $ref resolves within the document", () => {
    const refs: string[] = [];
    const walk = (node: unknown): void => {
      if (!node || typeof node !== "object") return;
      const record = node as Record<string, unknown>;
      if (typeof record.$ref === "string") refs.push(record.$ref);
      for (const value of Object.values(record)) walk(value);
    };
    walk(committed);
    expect(refs.length).toBeGreaterThan(0);
    for (const ref of refs) {
      expect(resolvePointer(ref), `unresolved $ref: ${ref}`).toBeDefined();
    }
  });

  test("global bearer security; GET /health overrides with security: [] (D10)", () => {
    expect(committed.security).toEqual([{ bearerAuth: [] }]);
    const schemes = (committed.components as Spec).securitySchemes as Spec;
    const bearer = schemes.bearerAuth as Record<string, unknown>;
    expect(bearer.type).toBe("http");
    expect(bearer.scheme).toBe("bearer");

    for (const { path, op } of operations()) {
      if (path === "/health") {
        expect(op.security, "health must carry security: []").toEqual([]);
      } else {
        expect(
          op.security,
          `${path} must inherit the global bearer requirement`
        ).toBeUndefined();
      }
    }
  });

  test("every response documents the stability header; every operation documents 429/500/503; auth'd operations document 401", () => {
    for (const { path, method, op } of operations()) {
      const responses = op.responses as Record<string, unknown>;
      const statuses = Object.keys(responses);
      const label = `${method} ${path}`;

      for (const status of ["429", "500", "503"]) {
        expect(statuses, `${label} missing ${status}`).toContain(status);
      }
      if (path === "/health") {
        expect(statuses, `${label} is unauthenticated`).not.toContain("401");
      } else {
        expect(statuses, `${label} missing 401`).toContain("401");
      }

      for (const [status, raw] of Object.entries(responses)) {
        const response = resolvedResponse(raw);
        const headers = response.headers as Record<string, unknown> | undefined;
        expect(
          headers?.[API_STABILITY_HEADER],
          `${label} ${status} does not document ${API_STABILITY_HEADER}`
        ).toBeDefined();
      }
    }

    const headerComponents = (committed.components as Spec).headers as Spec;
    const stability = headerComponents.XApiStability as {
      schema: { enum: string[] };
    };
    expect(stability.schema.enum).toEqual([API_STABILITY_VALUE]);
  });

  test("429 documents Retry-After plus the X-RateLimit-* trio; 503 documents Retry-After (§3)", () => {
    const responses = (committed.components as Spec).responses as Spec;
    const rateLimited = responses.RateLimited as Record<string, unknown>;
    const rateLimitedHeaders = rateLimited.headers as Record<string, unknown>;
    for (const name of [
      "Retry-After",
      "X-RateLimit-Limit",
      "X-RateLimit-Remaining",
      "X-RateLimit-Reset",
    ]) {
      expect(rateLimitedHeaders[name], `429 missing ${name}`).toBeDefined();
    }
    const unavailable = responses.ServiceUnavailable as Record<string, unknown>;
    expect(
      (unavailable.headers as Record<string, unknown>)["Retry-After"]
    ).toBeDefined();
    expect(unavailable["x-problem-codes"]).toEqual(["service_unavailable"]);
    expect(rateLimited["x-problem-codes"]).toEqual(["rate_limited"]);
  });
});

describe("registry parity — spec vs @/lib/api/problem", () => {
  const problem = (
    (committed.components as Spec).schemas as Record<string, Spec>
  ).Problem;
  const codeEnum = (
    (problem.properties as Record<string, Spec>).code as { enum: string[] }
  ).enum;

  test("Problem.code enum equals the shipped registry, both directions", () => {
    expect([...codeEnum].sort()).toEqual([...PROBLEM_CODES].sort());
  });

  test("x-problem-registry mirrors PROBLEM_REGISTRY statuses and titles, both directions", () => {
    const mirrored = committed["x-problem-registry"] as Record<
      string,
      { status: number; title: string; defaultDetail: string }
    >;
    expect(Object.keys(mirrored).sort()).toEqual([...PROBLEM_CODES].sort());
    for (const code of PROBLEM_CODES) {
      expect(mirrored[code], `spec missing registry code ${code}`).toEqual({
        status: PROBLEM_REGISTRY[code].status,
        title: PROBLEM_REGISTRY[code].title,
        defaultDetail: PROBLEM_REGISTRY[code].detail,
      });
    }
  });

  test("every x-problem-codes entry is a registry code, and every code except `not_found` is reachable on some operation", () => {
    const documented = new Set<string>();
    for (const { op } of operations()) {
      for (const raw of Object.values(op.responses as Record<string, unknown>)) {
        const codes = resolvedResponse(raw)["x-problem-codes"] as
          | string[]
          | undefined;
        for (const code of codes ?? []) documented.add(code);
      }
    }
    for (const code of documented) {
      expect(PROBLEM_CODES as readonly string[]).toContain(code);
    }
    // `not_found` is in the registry but no shipped handler emits it (no
    // by-id read exists). If a new registry code lands, this forces the spec
    // to say where it can occur — or to consciously extend this list.
    const unreachable = PROBLEM_CODES.filter((code) => !documented.has(code));
    expect(unreachable).toEqual(["not_found"]);
  });
});

describe("scope parity — spec vs V1_SCOPES (D11/D12)", () => {
  const paths = committed.paths as Record<string, Record<string, Spec>>;

  test("POST /v1/rounds requires rounds:write alone", () => {
    expect(paths["/rounds"]?.post?.["x-required-scopes"]).toEqual([
      V1_SCOPES.roundsWrite,
    ]);
  });

  test("GET /v1/rounds requires rounds:read OR rounds:write", () => {
    expect(paths["/rounds"]?.get?.["x-required-scopes-any-of"]).toEqual([
      V1_SCOPES.roundsRead,
      V1_SCOPES.roundsWrite,
    ]);
  });

  test("catalog reads and health carry no scope requirement", () => {
    for (const path of ["/courses", "/tees"]) {
      expect(paths[path]?.get?.["x-required-scopes"]).toEqual([]);
      expect(paths[path]?.get?.["x-required-scopes-any-of"]).toBeUndefined();
    }
    expect(paths["/health"]?.get?.["x-required-scopes"]).toBeUndefined();
  });
});

describe("round resource parity — spec vs the shipped serializer", () => {
  const schemas = (committed.components as Spec).schemas as Record<
    string,
    Spec
  >;
  const resource = schemas.RoundResource;
  const properties = resource.properties as Record<string, Spec>;

  const source: V1RoundSource = {
    id: 42,
    externalId: "fitbull-round-1",
    quarantined: true,
    courseId: 7,
    teeId: 21,
    teeTime: "2026-07-01T10:00:00",
    nineHoleSection: "back",
    notes: null,
    holesPlayed: 9,
    totalStrokes: 44,
    parPlayed: 36,
    adjustedGrossScore: 44,
    adjustedPlayedScore: 44,
    courseHandicap: 12,
    scoreDifferential: "7.4",
    updatedHandicapIndex: "18.3",
    courseRatingUsed: 35.2,
    slopeRatingUsed: 122,
    createdAt: new Date("2026-07-01T12:00:00Z"),
    updatedAt: "2026-07-01T12:00:00+00:00",
  };

  test("the serializer's runtime output has exactly the spec's properties, all required", () => {
    const emitted = Object.keys(serializeV1Round(source)).sort();
    expect(Object.keys(properties).sort()).toEqual(emitted);
    expect([...(resource.required as string[])].sort()).toEqual(emitted);
  });

  test("the extensible enums carry the shipped values and stay open (x-extensible-enum, never enum)", () => {
    const status = properties.status as Record<string, unknown>;
    expect(status["x-extensible-enum"]).toEqual(
      expect.arrayContaining([v1RoundStatus(false), v1RoundStatus(true)])
    );
    expect(status.enum, "status must not be a closed enum (§4)").toBeUndefined();

    const revision = properties.handicapRevision as Record<string, unknown>;
    expect(revision["x-extensible-enum"]).toEqual(
      expect.arrayContaining([V1_HANDICAP_REVISION_PENDING])
    );
    expect(revision["x-extensible-enum"]).toEqual([
      "pending",
      "current",
      "failed",
    ]);
    expect(
      revision.enum,
      "handicapRevision must not be a closed enum (§4)"
    ).toBeUndefined();
  });

  test("POST 201, POST 200 replay and the list entries share the identical shape (§2 rule 2, §5)", () => {
    const post = (committed.paths as Record<string, Record<string, Spec>>)[
      "/rounds"
    ]?.post as Spec;
    const responses = post.responses as Record<string, unknown>;
    const schemaRefOf = (status: string): unknown => {
      const content = resolvedResponse(responses[status]).content as Record<
        string,
        { schema: unknown }
      >;
      return content["application/json"]?.schema;
    };
    const roundRef = { $ref: "#/components/schemas/RoundResource" };
    expect(schemaRefOf("201")).toEqual(roundRef);
    expect(schemaRefOf("200")).toEqual(roundRef);

    const page = schemas.RoundsPage.properties as Record<string, Spec>;
    expect((page.data as { items: unknown }).items).toEqual(roundRef);
  });
});

describe("contractual prose survives in the committed file", () => {
  // Sentinels are HARD-CODED here (not imported from the generator) so the
  // verbatim §2/§5/§6 blocks cannot be dropped by editing the generator and
  // regenerating — this is the one check regen-and-diff cannot provide.
  const sentinels: [string, string][] = [
    [
      "§5 eventual consistency — extensible handicapRevision",
      'any value you do not recognize means \\"not current.\\"',
    ],
    [
      "§5 quarantine — extensible status",
      'any value you do not recognize means \\"not active.\\"',
    ],
    [
      "§5 quarantine — no round_limit_reached",
      "no `round_limit_reached` error code exists on this endpoint",
    ],
    [
      "§2 idempotency_conflict — non-escalating guidance",
      "do not retry with the same key, and do not treat this as a lost write",
    ],
    [
      "§6 auth — health exception (D10)",
      "All `/api/v1` endpoints **except `GET /v1/health`**",
    ],
    ["§6 auth — openid warning", "Do not request the `openid` scope."],
    [
      "§4 tolerant reader",
      "clients MUST ignore unknown response fields",
    ],
    [
      "§1 framework caveat",
      "emitted by the framework and infrastructure layers",
    ],
  ];

  test.each(sentinels)("%s", (_label, sentinel) => {
    expect(committedRaw).toContain(sentinel);
  });

  test("the field-level codes the handlers emit are all documented", () => {
    for (const code of [
      TEE_TIME_FIELD_CODE,
      V1_EXTERNAL_ID_FIELD_CODE,
      V1_TEE_HOLES_FIELD_CODE,
      NUL_IN_QUERY_FIELD_CODE,
      SCORE_HOLE_MISMATCH_FIELD_CODE,
    ]) {
      expect(committedRaw, `field code ${code} missing from spec`).toContain(
        code
      );
    }
  });
});
