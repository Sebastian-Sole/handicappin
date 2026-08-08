/**
 * Emit the committed `/v1` OpenAPI 3.1 spec — `pnpm gen:openapi`.
 *
 * Regenerates `docs/api/v1/openapi.json` (repo root) from the shipped zod
 * schemas and contract constants via `app/api/v1/_lib/openapi.ts`. The unit
 * test `tests/unit/api/v1/openapi-spec.test.ts` is the CI gate: it rebuilds
 * the document in memory and fails when the committed file diverges, so any
 * change to the `/v1` surface must be followed by this script.
 *
 * Run from `apps/web`: `pnpm gen:openapi` (or `tsx scripts/generate-openapi.ts`).
 */

// Env validation must be off BEFORE the builder's import graph pulls
// `@/env`-dependent modules (rate-limit, bearer-token, db) — same convention
// as `tests/setup-env.ts`. The builder is imported dynamically below because
// a static import would be hoisted above this assignment.
process.env.SKIP_ENV_VALIDATION ||= "1";

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

async function main(): Promise<void> {
  const { renderV1OpenApiJson, V1_OPENAPI_SPEC_REPO_PATH } = await import(
    "@/app/api/v1/_lib/openapi"
  );

  const scriptsDir = dirname(fileURLToPath(import.meta.url));
  const repoRoot = resolve(scriptsDir, "../../..");
  const specPath = resolve(repoRoot, V1_OPENAPI_SPEC_REPO_PATH);

  await mkdir(dirname(specPath), { recursive: true });
  await writeFile(specPath, renderV1OpenApiJson(), "utf8");

  process.stdout.write(`OpenAPI 3.1 spec written to ${specPath}\n`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
