import { cookies } from "next/headers";
import { env } from "@/env";

/**
 * Decodes a base64url-encoded string (Node.js compatible).
 */
function base64urlDecode(str: string): string {
  // Convert base64url to base64
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");

  // Add padding if needed
  const pad = base64.length % 4;
  if (pad) {
    if (pad === 1) {
      throw new Error("Invalid base64url string");
    }
    base64 += "=".repeat(4 - pad);
  }

  return Buffer.from(base64, "base64").toString("utf-8");
}

/**
 * Extract user ID from Supabase session cookie without API call.
 * Uses cookies() which is fast and doesn't block rendering like getUser().
 *
 * NOTE: This is for UI display only (navbar links).
 * Actual auth validation happens in middleware.
 *
 * Supabase SSR stores session in chunked cookies for large JWTs:
 * - sb-{project-ref}-auth-token (single cookie for small sessions)
 * - sb-{project-ref}-auth-token.0, .1, .2, etc. (chunked for large sessions)
 */
export async function getUserIdFromCookies(): Promise<string | null> {
  const cookieStore = await cookies();

  // Supabase cookie name: sb-{project-ref}-auth-token
  // Extract project ref from URL: https://abc123.supabase.co → abc123
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
  const cookieBaseName = `sb-${projectRef}-auth-token`;

  // DEBUG: Log all cookies to understand the format
  const allCookies = cookieStore.getAll();
  const authRelatedCookies = allCookies.filter(
    (c) => c.name.includes("sb-") || c.name.includes("supabase"),
  );

  try {
    // Try to get the session from cookies
    // Supabase SSR may chunk large sessions across multiple cookies
    let sessionString: string | null = null;

    // First, try the non-chunked cookie
    const singleCookie = cookieStore.get(cookieBaseName);
    if (singleCookie?.value) {
      sessionString = singleCookie.value;
    } else {
      // Try chunked cookies (for large JWTs)
      const chunks: string[] = [];
      let chunkIndex = 0;

      while (true) {
        const chunkCookie = cookieStore.get(`${cookieBaseName}.${chunkIndex}`);
        if (!chunkCookie?.value) {
          break;
        }
        chunks.push(chunkCookie.value);
        chunkIndex++;
      }

      if (chunks.length > 0) {
        sessionString = chunks.join("");
      }
    }

    if (!sessionString) {
      return null;
    }

    // Supabase SSR stores cookies with "base64-" prefix followed by base64-encoded JSON
    let decodedString = sessionString;

    // Handle "base64-" prefix (Supabase SSR format)
    if (sessionString.startsWith("base64-")) {
      const base64Content = sessionString.slice(7); // Remove "base64-" prefix
      decodedString = Buffer.from(base64Content, "base64").toString("utf-8");
    } else if (sessionString.includes("%")) {
      // Fallback: URL-encoded JSON (older format)
      try {
        decodedString = decodeURIComponent(sessionString);
      } catch {
        // Keep original if URL decode fails
      }
    }

    // Parse the session JSON to get the access_token
    const session = JSON.parse(decodedString) as {
      access_token?: string;
      user?: { id?: string };
    };

    // Method 1: Try to get user ID directly from session.user
    if (session?.user?.id) {
      return session.user.id;
    }

    // Method 2: Extract user ID from JWT access_token's 'sub' claim
    if (session?.access_token) {
      const parts = session.access_token.split(".");
      if (parts.length === 3) {
        const payload = JSON.parse(base64urlDecode(parts[1])) as {
          sub?: string;
        };
        if (payload.sub) {
          return payload.sub;
        }
      }
    }

    return null;
  } catch (error) {
    return null;
  }
}
