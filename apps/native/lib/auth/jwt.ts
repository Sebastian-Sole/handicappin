/**
 * Billing claims from the Supabase access token — port of
 * apps/web/utils/supabase/jwt.ts (same custom-claims hook, same caveats:
 * the signature was already verified by Supabase; use these claims for
 * client-side ROUTING/DISPLAY only, never authorization).
 */

export interface BillingClaims {
  plan: string | null;
  status: string | null;
  current_period_end: number | null;
  cancel_at_period_end: boolean;
  billing_version: number;
}

type SessionWithToken = { access_token: string } | null;

function base64urlDecode(value: string): string {
  let base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const pad = base64.length % 4;
  if (pad === 1) throw new Error("Invalid base64url string");
  if (pad) base64 += "=".repeat(4 - pad);
  // atob is provided by Expo's winter runtime on Hermes.
  return decodeURIComponent(
    atob(base64)
      .split("")
      .map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
      .join(""),
  );
}

export function getBillingFromJWT(
  session: SessionWithToken,
): BillingClaims | null {
  if (!session?.access_token) return null;
  try {
    const payload = session.access_token.split(".")[1];
    if (!payload) return null;
    const claims: unknown = JSON.parse(base64urlDecode(payload));
    if (typeof claims !== "object" || claims === null) return null;
    // Web reads app_metadata.billing (the custom-claims hook nests it there).
    const appMetadata = (claims as Record<string, unknown>)["app_metadata"];
    const billing =
      typeof appMetadata === "object" && appMetadata !== null
        ? (appMetadata as Record<string, unknown>)["billing"]
        : undefined;
    if (typeof billing !== "object" || billing === null) return null;
    const b = billing as Record<string, unknown>;
    return {
      plan: typeof b["plan"] === "string" ? b["plan"] : null,
      status: typeof b["status"] === "string" ? b["status"] : null,
      current_period_end:
        typeof b["current_period_end"] === "number"
          ? b["current_period_end"]
          : null,
      cancel_at_period_end: b["cancel_at_period_end"] === true,
      billing_version:
        typeof b["billing_version"] === "number" ? b["billing_version"] : 1,
    };
  } catch {
    return null;
  }
}
