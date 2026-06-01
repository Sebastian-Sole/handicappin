"use client";

import { usePathname } from "next/navigation";
import { isAuthRoutePath } from "@/lib/auth-routes";

export function useIsAuthRoute() {
  const pathname = usePathname() ?? "";
  return isAuthRoutePath(pathname);
}

export function ChromeGate({ children }: { children: React.ReactNode }) {
  const isAuthRoute = useIsAuthRoute();
  if (isAuthRoute) return null;
  return <>{children}</>;
}

/**
 * Wraps non-auth route children in a single `<main>` element with the global
 * page padding. On auth routes the wrapper is suppressed entirely so the
 * `(auth)/layout.tsx` route-group layout can own its own `<header>` + `<main>`
 * structure (otherwise the auth header would render inside the root `<main>`,
 * which is semantically incorrect and a11y-hostile).
 */
export function MainShell({ children }: { children: React.ReactNode }) {
  const isAuthRoute = useIsAuthRoute();
  if (isAuthRoute) {
    return <>{children}</>;
  }
  return (
    <main className="grow bg-background flex flex-col pt-3xl">{children}</main>
  );
}
