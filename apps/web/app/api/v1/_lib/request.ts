/**
 * Request-body intake for `/v1`.
 *
 * Contract §1, recorded under "Corpus-silent items resolved by default":
 * **wrong content type → 400 `malformed_request`, NOT 415
 * `Unsupported Media Type`.** That is deliberate — one fewer registry code,
 * at the cost of being less HTTP-idiomatic. Do not "fix" it to a 415; the
 * registry is closed and 415 has no code.
 *
 * Unparseable JSON maps to the same 400 `malformed_request`. Schema failures
 * are a different thing entirely (422 `validation_failed` with `errors[]`)
 * and are produced by the caller after a successful parse here.
 */

import { createProblem, type ProblemDocument } from "@/lib/api/problem";

/**
 * Media types accepted on a `/v1` write. `application/json` plus the
 * structured-suffix form (`application/<something>+json`), both allowed to
 * carry parameters (`; charset=utf-8`).
 */
export function isAcceptedJsonContentType(contentType: string | null): boolean {
  if (!contentType) return false;
  const mediaType = contentType.split(";", 1)[0]?.trim().toLowerCase() ?? "";
  return mediaType === "application/json" || mediaType.endsWith("+json");
}

export type JsonBodyResult =
  | { ok: true; value: unknown }
  | { ok: false; problem: ProblemDocument };

/**
 * Read and parse a JSON request body.
 *
 * Returns `malformed_request` (400) for a missing/wrong content type or a
 * body that is not parseable JSON. The `detail` distinguishes the two for a
 * developer without naming anything internal.
 */
export async function readJsonBody(
  request: Request,
  context: { instance?: string } = {}
): Promise<JsonBodyResult> {
  if (!isAcceptedJsonContentType(request.headers.get("content-type"))) {
    return {
      ok: false,
      problem: createProblem({
        code: "malformed_request",
        detail: "Content-Type must be application/json.",
        instance: context.instance,
      }),
    };
  }

  try {
    const value: unknown = await request.json();
    return { ok: true, value };
  } catch {
    return {
      ok: false,
      problem: createProblem({
        code: "malformed_request",
        detail: "Request body is not valid JSON.",
        instance: context.instance,
      }),
    };
  }
}
