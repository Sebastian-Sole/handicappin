import type { ReactNode } from "react";

import { H1 } from "@/components/ui/typography";
import { cn } from "@/lib/utils";

interface AuthFormShellProps {
  children: ReactNode;
  className?: string;
  /**
   * Optional centered title rendered above children.
   * Pair with `description` for a consistent auth/recovery header.
   */
  title?: ReactNode;
  /**
   * Optional centered description rendered under the title.
   */
  description?: ReactNode;
}

/**
 * Shared wrapper for auth/recovery surfaces (login, signup, forgot-password,
 * update-password, verify-session, verify-signup) and their loading skeletons.
 *
 * Renders a narrow, centered column on a flex-centered canvas so every entry
 * point in the auth journey has the same visual treatment. Pass `title` /
 * `description` for the canonical header, or render your own children for
 * state-heavy surfaces (e.g. verify-session) that need bespoke layout per
 * state.
 *
 * Padding varies per caller, so callers pass it (and any other extras)
 * through `className`.
 */
export function AuthFormShell({
  children,
  className,
  title,
  description,
}: AuthFormShellProps) {
  return (
    <div
      className={cn(
        "mx-auto w-[90%] max-w-sm space-y-lg min-h-full sm:min-w-[40%]",
        className,
      )}
    >
      {(title || description) && (
        <div className="space-y-sm text-center">
          {title ? <H1>{title}</H1> : null}
          {description ? (
            <p className="text-muted-foreground">{description}</p>
          ) : null}
        </div>
      )}
      {children}
    </div>
  );
}
