import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";
import {
  isAllowedHost,
  isBlockedPublicApiRequest,
  V1_UNSUPPORTED_HOST_REWRITE_PATH,
} from "@/lib/host-guard";

export async function proxy(request: NextRequest) {
  // /v1 host scoping — on the production deployment, `api.handicappin.com`
  // is the only supported base host for `/api/v1` (api-platform contract
  // 005-phase0-contract.md §1). Checked FIRST so an unsupported-host /v1
  // request spends no session, auth, or rate-limit work — and so an absent/
  // garbage Host on a /v1 path 404s like any unmatched path instead of
  // 400ing. The rewrite targets a path no route matches, so the client sees
  // the framework's own 404 — indistinguishable from probing a nonexistent
  // path (a 403 or custom body would itself be an oracle confirming this
  // host serves /v1). VERCEL_ENV is a Vercel platform var read from
  // process.env by design — env.ts does not carry platform vars (same
  // exception as server/api/routers/stripe.ts).
  if (
    isBlockedPublicApiRequest({
      pathname: request.nextUrl.pathname,
      hostHeader: request.headers.get("host"),
      vercelEnv: process.env.VERCEL_ENV,
    })
  ) {
    return NextResponse.rewrite(
      new URL(V1_UNSUPPORTED_HOST_REWRITE_PATH, request.url)
    );
  }

  // Host guard — security boundary (see lib/host-guard.ts). Requests with an
  // absent, unknown, or ported Host header are rejected before any session
  // or auth work runs. Covered by negative tests in
  // tests/unit/proxy-host-guard.test.ts.
  if (!isAllowedHost(request.headers.get("host"))) {
    return new NextResponse("Invalid Host header", { status: 400 });
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
