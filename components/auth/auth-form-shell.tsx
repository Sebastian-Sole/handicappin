import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface AuthFormShellProps {
  children: ReactNode;
  className?: string;
}

/**
 * Shared wrapper for auth/profile forms and their loading skeletons.
 *
 * Encapsulates the responsive sizing pattern used across signup, login,
 * forgot-password, update-password, and their skeleton counterparts.
 * Padding varies per caller, so callers pass it (and any other extras)
 * through `className`.
 */
export function AuthFormShell({ children, className }: AuthFormShellProps) {
  return (
    <div
      className={cn(
        "mx-auto w-[90%] max-w-sm space-y-lg min-h-full sm:min-w-[40%]",
        className,
      )}
    >
      {children}
    </div>
  );
}
