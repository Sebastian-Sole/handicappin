import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";
import { isAllowedHost } from "@/lib/host-guard";

export async function proxy(request: NextRequest) {
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
