/**
 * Run: deno test --allow-env supabase/functions/_shared/throttle.test.ts
 *
 * Uses a stubbed Supabase client (in-memory rows) so these tests don't need
 * a running Postgres instance — they only exercise the throttle decision
 * logic in throttle.ts.
 */
import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { checkOtpSendAllowed } from "./throttle.ts";

interface FakeOtpRow {
  email: string;
  otp_type: string;
  request_ip: string | null;
  created_at: string;
}

/**
 * Minimal stand-in for the chainable Supabase query builder, scoped to the
 * exact call shape throttle.ts uses:
 *   supabase.from("otp_verifications").select("created_at")
 *     .eq(col, val).eq(col2, val2)?.gte("created_at", iso)
 *     .order("created_at", { ascending: true })
 */
function createFakeSupabase(
  rows: FakeOtpRow[],
  opts: { simulateError?: boolean } = {}
) {
  return {
    from(_table: string) {
      const eqFilters: Record<string, unknown> = {};
      let gteValue: string | null = null;

      const builder = {
        select(_columns: string) {
          return builder;
        },
        eq(column: string, value: unknown) {
          eqFilters[column] = value;
          return builder;
        },
        gte(column: string, value: string) {
          if (column === "created_at") gteValue = value;
          return builder;
        },
        order(_column: string, _options?: { ascending: boolean }) {
          if (opts.simulateError) {
            return Promise.resolve({
              data: null,
              error: { message: "simulated query failure" },
            });
          }

          const filtered = rows
            .filter((row) => {
              for (const [key, value] of Object.entries(eqFilters)) {
                if ((row as unknown as Record<string, unknown>)[key] !== value) {
                  return false;
                }
              }
              if (gteValue !== null && row.created_at < gteValue) {
                return false;
              }
              return true;
            })
            .sort((a, b) => a.created_at.localeCompare(b.created_at))
            .map((row) => ({ created_at: row.created_at }));

          return Promise.resolve({ data: filtered, error: null });
        },
      };

      return builder;
    },
    // deno-lint-ignore no-explicit-any
  } as any;
}

function isoMinutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60 * 1000).toISOString();
}

Deno.test("checkOtpSendAllowed — allows sends under the per-email limit", async () => {
  const supabase = createFakeSupabase([
    { email: "a@test.com", otp_type: "password_reset", request_ip: "1.1.1.1", created_at: isoMinutesAgo(10) },
    { email: "a@test.com", otp_type: "password_reset", request_ip: "1.1.1.1", created_at: isoMinutesAgo(5) },
  ]);

  const result = await checkOtpSendAllowed(supabase, {
    email: "a@test.com",
    ip: "1.1.1.1",
    purpose: "password_reset",
  });

  assertEquals(result.allowed, true);
  assertEquals(result.retryAfterSeconds, undefined);
});

Deno.test("checkOtpSendAllowed — blocks at the per-email limit with retryAfterSeconds", async () => {
  const supabase = createFakeSupabase([
    { email: "a@test.com", otp_type: "password_reset", request_ip: "1.1.1.1", created_at: isoMinutesAgo(50) },
    { email: "a@test.com", otp_type: "password_reset", request_ip: "1.1.1.1", created_at: isoMinutesAgo(20) },
    { email: "a@test.com", otp_type: "password_reset", request_ip: "1.1.1.1", created_at: isoMinutesAgo(5) },
  ]);

  const result = await checkOtpSendAllowed(supabase, {
    email: "a@test.com",
    ip: "1.1.1.1",
    purpose: "password_reset",
  });

  assertEquals(result.allowed, false);
  assertExists(result.retryAfterSeconds);
  // Oldest counted row was 50 minutes ago; window frees ~10 minutes (600s) from now.
  const seconds = result.retryAfterSeconds as number;
  assertEquals(seconds > 0 && seconds <= 600, true);
});

Deno.test("checkOtpSendAllowed — different purpose for the same email does not count toward the limit", async () => {
  const supabase = createFakeSupabase([
    { email: "a@test.com", otp_type: "signup", request_ip: "1.1.1.1", created_at: isoMinutesAgo(5) },
    { email: "a@test.com", otp_type: "signup", request_ip: "1.1.1.1", created_at: isoMinutesAgo(4) },
    { email: "a@test.com", otp_type: "signup", request_ip: "1.1.1.1", created_at: isoMinutesAgo(3) },
  ]);

  const result = await checkOtpSendAllowed(supabase, {
    email: "a@test.com",
    ip: "1.1.1.1",
    purpose: "password_reset",
  });

  assertEquals(result.allowed, true);
});

Deno.test("checkOtpSendAllowed — blocks at the per-IP limit across different emails/purposes", async () => {
  const rows: FakeOtpRow[] = Array.from({ length: 10 }, (_, i) => ({
    email: `user${i}@test.com`,
    otp_type: i % 2 === 0 ? "password_reset" : "signup",
    request_ip: "9.9.9.9",
    created_at: isoMinutesAgo(50 - i),
  }));
  const supabase = createFakeSupabase(rows);

  const result = await checkOtpSendAllowed(supabase, {
    email: "brand-new@test.com",
    ip: "9.9.9.9",
    purpose: "password_reset",
  });

  assertEquals(result.allowed, false);
  assertExists(result.retryAfterSeconds);
});

Deno.test("checkOtpSendAllowed — null IP skips the per-IP check without blocking", async () => {
  const rows: FakeOtpRow[] = Array.from({ length: 10 }, (_, i) => ({
    email: `user${i}@test.com`,
    otp_type: "password_reset",
    request_ip: "9.9.9.9",
    created_at: isoMinutesAgo(50 - i),
  }));
  const supabase = createFakeSupabase(rows);

  const result = await checkOtpSendAllowed(supabase, {
    email: "brand-new@test.com",
    ip: null,
    purpose: "password_reset",
  });

  assertEquals(result.allowed, true);
});

Deno.test("checkOtpSendAllowed — fails open when the email-count query errors", async () => {
  const supabase = createFakeSupabase([], { simulateError: true });

  const result = await checkOtpSendAllowed(supabase, {
    email: "a@test.com",
    ip: "1.1.1.1",
    purpose: "password_reset",
  });

  assertEquals(result.allowed, true);
});
