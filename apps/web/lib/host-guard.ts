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
  if (!hostHeader) {
    return false;
  }

  const host = hostHeader.trim().toLowerCase();
  if (!host || /[\s/@\\]/.test(host)) {
    return false;
  }

  // Split into hostname + optional port, handling bracketed IPv6 ([::1]:3000).
  let name = host;
  let port: string | null = null;
  if (host.startsWith("[")) {
    const closing = host.indexOf("]");
    if (closing === -1) {
      return false;
    }
    name = host.slice(0, closing + 1);
    const rest = host.slice(closing + 1);
    if (rest) {
      if (!rest.startsWith(":")) {
        return false;
      }
      port = rest.slice(1);
    }
  } else {
    const colon = host.indexOf(":");
    if (colon !== -1) {
      // A second colon without brackets is malformed (unbracketed IPv6).
      if (host.indexOf(":", colon + 1) !== -1) {
        return false;
      }
      name = host.slice(0, colon);
      port = host.slice(colon + 1);
    }
  }

  if (port !== null && !/^\d{1,5}$/.test(port)) {
    return false;
  }

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
