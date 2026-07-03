/**
 * Send-side throttling for the OTP edge functions (password reset, signup
 * verification resend, signup verification send).
 *
 * Backed entirely by the existing `otp_verifications` table — no new
 * infrastructure. Every OTP send already inserts a row with `email`,
 * `otp_type`, `request_ip`, and `created_at`, so send-frequency per email
 * and per IP is directly queryable.
 *
 * Policy (env-overridable, defaults below):
 * - Per email+purpose: max N sends per rolling hour.
 * - Per IP (when known): max M sends per rolling hour, across all purposes.
 *   `otp_verifications.request_ip` exists (see
 *   supabase/migrations/20251224134322_add_otp_verifications_with_rls.sql),
 *   so this is a real per-IP count, not the "no IP column" fallback the
 *   plan anticipated.
 *
 * Fail-open: a DB blip must not lock every user out of password reset /
 * signup. Same philosophy as apps/web/lib/rate-limit.ts:72-83 — on query
 * error we log and allow the request through.
 */
import { createClient } from "jsr:@supabase/supabase-js@2";

// Typed with an explicit `any` Database generic: `ReturnType<typeof createClient>`
// (no generic applied) infers a subtly different structural type than what
// `createClient(url, key)` call sites resolve to, which TS then rejects as
// non-assignable. Passing `any` here matches how every call site in this
// repo constructs its client (no Database generic), so it accepts them all.
type SupabaseClient = ReturnType<typeof createClient<any>>;

const HOUR_MS = 60 * 60 * 1000;

function envInt(name: string, fallback: number): number {
  const raw = Deno.env.get(name);
  if (!raw) return fallback;
  const parsed = parseInt(raw, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

/** Max OTP sends per email+purpose per rolling hour. */
const PER_EMAIL_HOURLY_LIMIT = envInt("RATE_LIMIT_OTP_PER_EMAIL_HOUR", 3);

/** Max OTP sends per IP (any purpose) per rolling hour. */
const PER_IP_HOURLY_LIMIT = envInt("RATE_LIMIT_OTP_PER_IP_HOUR", 10);

export interface CheckOtpSendAllowedOptions {
  email: string;
  ip: string | null;
  purpose: string;
}

export interface CheckOtpSendAllowedResult {
  allowed: boolean;
  retryAfterSeconds?: number;
}

/** Shape of the single column we select for throttle counting. */
interface OtpTimestampRow {
  created_at: string;
}

/**
 * Compute how many seconds until the throttle window frees up a slot,
 * based on the oldest row counted in the current window.
 */
function retryAfterFromOldest(oldestCreatedAt: string, now: number): number {
  const oldestMs = new Date(oldestCreatedAt).getTime();
  const freesAt = oldestMs + HOUR_MS;
  return Math.max(1, Math.ceil((freesAt - now) / 1000));
}

/**
 * Decide whether an OTP-send request should be allowed through, based on
 * how many OTPs have already been sent to this email (for this purpose)
 * and from this IP (across all purposes) in the last hour.
 *
 * Fails open on any DB error — a query failure must not block legitimate
 * password resets / signup verification.
 */
export async function checkOtpSendAllowed(
  supabase: SupabaseClient,
  opts: CheckOtpSendAllowedOptions
): Promise<CheckOtpSendAllowedResult> {
  const { email, ip, purpose } = opts;
  const now = Date.now();
  const windowStartIso = new Date(now - HOUR_MS).toISOString();

  try {
    // Per email+purpose check
    const { data: emailData, error: emailError } = await supabase
      .from("otp_verifications")
      .select("created_at")
      .eq("email", email)
      .eq("otp_type", purpose)
      .gte("created_at", windowStartIso)
      .order("created_at", { ascending: true });
    const emailRows = emailData as OtpTimestampRow[] | null;

    if (emailError) {
      console.warn(
        "[throttle] Failed to query per-email OTP send count, failing open",
        { purpose, error: emailError.message }
      );
      return { allowed: true };
    }

    if (emailRows && emailRows.length >= PER_EMAIL_HOURLY_LIMIT) {
      return {
        allowed: false,
        retryAfterSeconds: retryAfterFromOldest(
          emailRows[0].created_at as string,
          now
        ),
      };
    }

    // Per IP check (skipped when IP is unknown/unavailable)
    if (ip) {
      const { data: ipData, error: ipError } = await supabase
        .from("otp_verifications")
        .select("created_at")
        .eq("request_ip", ip)
        .gte("created_at", windowStartIso)
        .order("created_at", { ascending: true });
      const ipRows = ipData as OtpTimestampRow[] | null;

      if (ipError) {
        console.warn(
          "[throttle] Failed to query per-IP OTP send count, failing open",
          { error: ipError.message }
        );
        return { allowed: true };
      }

      if (ipRows && ipRows.length >= PER_IP_HOURLY_LIMIT) {
        return {
          allowed: false,
          retryAfterSeconds: retryAfterFromOldest(
            ipRows[0].created_at as string,
            now
          ),
        };
      }
    } else {
      console.warn(
        "[throttle] No client IP available for this request — per-IP OTP throttling is inactive for this call",
        { purpose }
      );
    }

    return { allowed: true };
  } catch (error) {
    console.warn("[throttle] Unexpected error checking OTP throttle, failing open", {
      purpose,
      error: error instanceof Error ? error.message : String(error),
    });
    return { allowed: true };
  }
}
