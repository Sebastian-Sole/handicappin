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
 * SECURITY NOTE:
 * - The JWT signature has ALREADY been verified by Supabase's getSession()
 * - These billing claims should ONLY be used for client-side routing and display
 * - Server-side actions that grant access or modify data MUST still validate
 *   using proper server-side checks (e.g., getComprehensiveUserAccess())
 * - This approach is safe because:
 *   1. We trust the session came from Supabase (signature verified)
 *   2. We use these claims only for UX decisions (which page to show)
 *   3. Any sensitive operations re-validate access on the server
 *
 * @param session - The Supabase session object containing the access token
 * @returns The billing claims from the JWT, or null if not available
 */
/**
 * Decode base64url string (works in both Node.js and browser)
 */
function base64urlDecode(str: string): string {
  // Convert base64url to base64
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');

  // Add padding if needed
  const pad = base64.length % 4;
  if (pad) {
    if (pad === 1) {
      throw new Error('Invalid base64url string');
    }
    base64 += '='.repeat(4 - pad);
  }

  // Decode base64
  if (typeof window !== 'undefined') {
    // Browser environment
    return atob(base64);
  } else {
    // Node.js environment
    return Buffer.from(base64, 'base64').toString('utf-8');
  }
}

export function getBillingFromJWT(session: Session | null): BillingClaims | null {
  if (!session?.access_token) {
    return null;
  }

  try {
    const parts = session.access_token.split('.');
    if (parts.length === 3) {
      const payload = JSON.parse(base64urlDecode(parts[1]));
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
 * SECURITY NOTE:
 * - The JWT signature has ALREADY been verified by Supabase's getSession()
 * - These app_metadata claims should ONLY be used for client-side routing and authorization
 * - Server-side actions that grant access or modify data MUST still validate
 *   using proper server-side checks (e.g., getComprehensiveUserAccess())
 * - This approach is safe because:
 *   1. We trust the session came from Supabase (signature verified)
 *   2. We use these claims only for authorization decisions (which page to show)
 *   3. Any sensitive operations re-validate access on the server
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
      const payload = JSON.parse(base64urlDecode(parts[1]));
      return payload.app_metadata || null;
    }
  } catch (e) {
    console.error('❌ Failed to decode JWT token:', e);
    return null;
  }

  return null;
}
