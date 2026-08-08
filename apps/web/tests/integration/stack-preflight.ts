/**
 * Vitest globalSetup for `pnpm test:integration` (wired in
 * `vitest.config.integration.ts` — NOT the base config, so unit runs are
 * untouched).
 *
 * Why this exists: 21 of the 24 integration suites sit behind a
 * `describeIfLocal` guard and `describe.skip` themselves when the local
 * Supabase stack is unreachable. Without a preflight, `pnpm test:integration`
 * with the stack down executed almost nothing and still exited 0 — a silent
 * green that reads as "integration passed". This setup makes that state a
 * loud failure instead.
 *
 * Opt-out: set `ALLOW_INTEGRATION_SKIP=1` for contexts that legitimately run
 * without a stack (CI sets it explicitly in `.github/workflows/ci.yml`). The
 * suites then skip exactly as before, but the skip is deliberate and visible.
 */
import { hasLocalStack } from "./helpers/v1-principals";

const BANNER = "=".repeat(72);

function isSkipAllowed(): boolean {
  const value = process.env.ALLOW_INTEGRATION_SKIP;
  return value === "1" || value === "true";
}

/** Probe the local GoTrue health endpoint — env vars alone can lie. */
async function stackReachable(supabaseUrl: string): Promise<string | null> {
  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/health`, {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "" },
      signal: AbortSignal.timeout(3_000),
    });
    if (!response.ok) {
      return `health endpoint responded ${response.status}`;
    }
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

export default async function stackPreflight(): Promise<void> {
  let problem: string | null = null;

  if (!hasLocalStack) {
    problem =
      "environment is not a local stack (DATABASE_URL must point at " +
      "127.0.0.1/localhost, and NEXT_PUBLIC_SUPABASE_URL / " +
      "NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY must be " +
      "real, non-dummy values)";
  } else {
    const unreachable = await stackReachable(
      process.env.NEXT_PUBLIC_SUPABASE_URL!
    );
    if (unreachable) {
      problem = `local Supabase stack is not responding: ${unreachable}`;
    }
  }

  if (!problem) return;

  if (isSkipAllowed()) {
    console.warn(
      [
        BANNER,
        "[integration preflight] ALLOW_INTEGRATION_SKIP is set —",
        `  ${problem}.`,
        "  Stack-gated suites (most of the integration files) will be SKIPPED, not run.",
        "  This run does NOT verify integration behavior.",
        BANNER,
      ].join("\n")
    );
    return;
  }

  throw new Error(
    [
      BANNER,
      "[integration preflight] Refusing to run: " + problem + ".",
      "",
      "Most integration suites (21 of 24 files) are gated on a reachable local",
      "Supabase stack and would silently skip, making this run a green",
      "no-op. Start the stack (`supabase start`) and retry, or — if running",
      "without a stack is intentional — set ALLOW_INTEGRATION_SKIP=1 to",
      "skip them visibly.",
      BANNER,
    ].join("\n")
  );
}
