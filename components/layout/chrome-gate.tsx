"use client";

import { usePathname } from "next/navigation";

const AUTH_PATH_PREFIXES = [
  "/login",
  "/signup",
  "/forgot-password",
  "/update-password",
  "/verify-signup",
  "/verify-email",
  "/auth/verify-session",
];

export function useIsAuthRoute() {
  const pathname = usePathname() ?? "";
  return AUTH_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function ChromeGate({ children }: { children: React.ReactNode }) {
  const isAuthRoute = useIsAuthRoute();
  if (isAuthRoute) return null;
  return <>{children}</>;
}

export function MainShell({ children }: { children: React.ReactNode }) {
  const isAuthRoute = useIsAuthRoute();
  return (
    <main
      className={`grow bg-background flex flex-col ${
        isAuthRoute ? "" : "pt-3xl"
      }`}
    >
      {children}
    </main>
  );
}
