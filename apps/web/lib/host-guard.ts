/**
 * Host allowlist guard for the middleware (`apps/web/proxy.ts`).
 *
 * The middleware is a security boundary (CVE-2025-29927-class middleware
 * bypass history), so requests whose `Host` header is absent, wrong, or
 * carries an unexpected port are rejected before any session work runs.
 * Vercel already routes by Host, so legitimate traffic always arrives with
 * one of ours — this guard is defense-in-depth against forged Host headers
 * reaching the origin directly (host-header injection, cache poisoning,
 * password-reset link poisoning).
 *
 * IS:     an exact allowlist check on the Host header (production hosts,
 *         Vercel deployment URLs, local dev hosts).
 * IS NOT: authentication, and not a substitute for the rate-limit or auth
 *         layers — it only bounds which hosts the middleware serves at all.
 *
 * See docs/ingress-firewall-state.md (api-platform subplan 001 / W0).
 */

/** Hosts the production app serves. `api.` is the grey-clouded API host. */
export const ALLOWED_PRODUCTION_HOSTS = [
  "handicappin.com",
  "www.handicappin.com",
  "api.handicappin.com",
] as const;

const PRODUCTION_HOSTS = new Set<string>(ALLOWED_PRODUCTION_HOSTS);

/** Local development hostnames — any port is allowed for these. */
const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "0.0.0.0", "[::1]"]);

/** Vercel preview/deployment URLs (e.g. handicappin-abc-team.vercel.app). */
const VERCEL_DEPLOYMENT_SUFFIX = ".vercel.app";

/** Ports that may accompany a non-local host (default HTTP/HTTPS only). */
const DEFAULT_PORTS = new Set(["80", "443"]);

interface ParsedHost {
  /** Lowercased hostname (brackets kept for IPv6, e.g. `[::1]`). */
  name: string;
  /** Port digits, or `null` when the header carries no port. */
  port: string | null;
}

/**
 * Parse a Host header into hostname + optional port. Returns `null` for
 * absent/empty/malformed values (bad port, embedded whitespace/path/`@`,
 * unbracketed IPv6). Shared by `isAllowedHost` and the `/v1` host scoping
 * below so both reject malformed headers identically.
 */
function parseHostHeader(
  hostHeader: string | null | undefined
): ParsedHost | null {
  if (!hostHeader) {
    return null;
  }

  const host = hostHeader.trim().toLowerCase();
  if (!host || /[\s/@\\]/.test(host)) {
    return null;
  }

  // Split into hostname + optional port, handling bracketed IPv6 ([::1]:3000).
  let name = host;
  let port: string | null = null;
  if (host.startsWith("[")) {
    const closing = host.indexOf("]");
    if (closing === -1) {
      return null;
    }
    name = host.slice(0, closing + 1);
    const rest = host.slice(closing + 1);
    if (rest) {
      if (!rest.startsWith(":")) {
        return null;
      }
      port = rest.slice(1);
    }
  } else {
    const colon = host.indexOf(":");
    if (colon !== -1) {
      // A second colon without brackets is malformed (unbracketed IPv6).
      if (host.indexOf(":", colon + 1) !== -1) {
        return null;
      }
      name = host.slice(0, colon);
      port = host.slice(colon + 1);
    }
  }

  if (port !== null && !/^\d{1,5}$/.test(port)) {
    return null;
  }

  return { name, port };
}

/**
 * Validate a Host header against the allowlist.
 *
 * Rejections (all return `false`, never throw):
 * - absent/empty header
 * - unknown hosts (`evil.com`, `handicappin.com.evil.com`)
 * - "ported" hosts — a non-default port on a non-local host
 *   (`handicappin.com:8080`)
 * - malformed values (bad port, embedded whitespace/path, trailing-dot FQDN
 *   tricks — exact match only)
 */
export function isAllowedHost(hostHeader: string | null | undefined): boolean {
  const parsed = parseHostHeader(hostHeader);
  if (parsed === null) {
    return false;
  }
  const { name, port } = parsed;

  // Local dev: any port.
  if (LOCAL_HOSTNAMES.has(name)) {
    return true;
  }

  // Non-local hosts must not smuggle a non-default port ("ported" Host).
  if (port !== null && !DEFAULT_PORTS.has(port)) {
    return false;
  }

  if (PRODUCTION_HOSTS.has(name)) {
    return true;
  }

  // Vercel preview/deployment URLs. Exact-suffix subdomain match only.
  if (
    name.endsWith(VERCEL_DEPLOYMENT_SUFFIX) &&
    name.length > VERCEL_DEPLOYMENT_SUFFIX.length
  ) {
    return true;
  }

  return false;
}

// ---------------------------------------------------------------------------
// /v1 host scoping (api-platform contract 005-phase0-contract.md §1)
// ---------------------------------------------------------------------------

/**
 * Path prefix of the public versioned API. Canonical definition — mirrored
 * (via re-export) by `lib/rate-limit.ts`, which cannot be imported here
 * because it would pull the Upstash client into the middleware edge bundle.
 */
export const PUBLIC_API_PATH_PREFIX = "/api/v1";

/**
 * The only supported base host for `/api/v1` (contract §1 "Host scoping").
 * Grey-clouded (DNS-only) API host — fitbull's and the native app's base URL.
 */
export const PUBLIC_API_HOST = "api.handicappin.com";

/**
 * Middleware rewrite target for `/v1` requests on an unsupported host. No
 * route matches it (and none may ever be added), so the framework renders
 * its own unmatched-path 404 — byte-identical to probing any nonexistent
 * path. Contract §1 already places framework 404s outside the problem+json
 * envelope, so this response is contract-clean.
 */
export const V1_UNSUPPORTED_HOST_REWRITE_PATH = "/__v1-unsupported-host";

/** Is this pathname on the public versioned API surface (`/api/v1`)? */
export function isPublicApiPath(pathname: string): boolean {
  return (
    pathname === PUBLIC_API_PATH_PREFIX ||
    pathname.startsWith(`${PUBLIC_API_PATH_PREFIX}/`)
  );
}

/**
 * Host scoping for the public `/v1` surface: on the PRODUCTION deployment,
 * `api.handicappin.com` is the only host that serves `/api/v1` — a `/v1`
 * request on any other host (apex, www, `*.vercel.app` production aliases,
 * absent/garbage Host) is refused (contract §1: "api.handicappin.com is the
 * only supported base host"; enforcing this guard is 005 build scope).
 *
 * IS:     a production-only refusal decision for `/v1`-path requests whose
 *         Host is not exactly `api.handicappin.com` (default ports only).
 * IS NOT: active on previews, local dev, or CI — `vercelEnv` anything other
 *         than `"production"` (including `undefined`) disables it, so
 *         localhost integration tests and preview deployments keep serving
 *         `/v1` unchanged.
 *
 * The refusal is deliberately a 404 (via rewrite to
 * `V1_UNSUPPORTED_HOST_REWRITE_PATH`), never a 403: a 403 would itself be an
 * oracle confirming the host serves `/v1`.
 */
export function isBlockedPublicApiRequest(opts: {
  pathname: string;
  hostHeader: string | null | undefined;
  /** Pass `process.env.VERCEL_ENV` (platform var; not carried by env.ts). */
  vercelEnv: string | undefined;
}): boolean {
  if (opts.vercelEnv !== "production") {
    return false;
  }
  if (!isPublicApiPath(opts.pathname)) {
    return false;
  }

  const parsed = parseHostHeader(opts.hostHeader);
  if (parsed === null) {
    // Absent or malformed Host on a production /v1 path: refuse.
    return true;
  }
  if (parsed.name !== PUBLIC_API_HOST) {
    return true;
  }
  // A non-default port on the API host ("ported" Host) is not supported.
  return parsed.port !== null && !DEFAULT_PORTS.has(parsed.port);
}
