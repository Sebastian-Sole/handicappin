import { Session } from "@supabase/supabase-js";

// Define billing claims type (minimal)
export type BillingClaims = {
  plan: string | null; // NULL when user hasn't selected a plan
  status: string | null; // NULL when user hasn't selected a plan
  current_period_end: number | null;
  cancel_at_period_end: boolean;
  billing_version: number;
};

/**
 * Extracts billing information from JWT access token
 *
 * This utility manually decodes the JWT to access custom claims that are not
 * available through session.user.app_metadata. The custom claims are added
 * by the Supabase access token hook.
 *
 * @param session - The Supabase session object containing the access token
 * @returns The billing claims from the JWT, or null if not available
 */
export function getBillingFromJWT(session: Session | null): BillingClaims | null {
  if (!session?.access_token) {
    return null;
  }

  try {
    const parts = session.access_token.split('.');
    if (parts.length === 3) {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
      return payload.app_metadata?.billing || null;
    }
  } catch (e) {
    console.error('❌ Failed to decode JWT token:', e);
    return null;
  }

  return null;
}

/**
 * Extracts full app_metadata from JWT access token
 *
 * Use this when you need all app_metadata, not just billing claims.
 *
 * @param session - The Supabase session object containing the access token
 * @returns The app_metadata from the JWT, or null if not available
 */
export function getAppMetadataFromJWT(session: Session | null): Record<string, any> | null {
  if (!session?.access_token) {
    return null;
  }

  try {
    const parts = session.access_token.split('.');
    if (parts.length === 3) {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
      return payload.app_metadata || null;
    }
  } catch (e) {
    console.error('❌ Failed to decode JWT token:', e);
    return null;
  }

  return null;
}
