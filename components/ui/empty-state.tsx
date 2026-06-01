import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface EmptyStateProps {
  /** Optional lucide icon element or emoji, shown in a muted chip above the title. */
  icon?: ReactNode;
  /** Primary message. */
  title: string;
  /** Optional supporting copy, rendered muted below the title. */
  description?: string;
  /** Optional call to action (e.g. a `<Button>` or `<Link>`) shown below the text. */
  action?: ReactNode;
  /**
   * Visual weight. `default` reads as a full-page/card empty (heading-sized
   * title). `compact` reads as a quiet inline caption for tiny slots (chart
   * placeholders, stat captions) where a bold heading would be a visual
   * regression.
   */
  size?: "default" | "compact";
  className?: string;
}

/**
 * Centered empty-state — icon chip, title, muted description, optional action.
 * The shared replacement for the ad-hoc "no data yet" blocks scattered across
 * data components (rounds table, activity feed, charts). Presentational only;
 * composes inside `surface`, `Card`, and `tint-*` containers.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  size = "default",
  className,
}: EmptyStateProps) {
  const compact = size === "compact";
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "py-md" : "py-xl",
        className
      )}
    >
      {icon && (
        <div
          className={cn(
            "icon-chip bg-muted text-muted-foreground",
            compact ? "mb-xs" : "mb-md"
          )}
        >
          {icon}
        </div>
      )}
      <p
        className={cn(
          compact
            ? "text-meta-strong text-foreground"
            : "text-heading-4 text-foreground"
        )}
      >
        {title}
      </p>
      {description && (
        <p
          className={cn(
            "mt-xs max-w-sm",
            compact
              ? "text-meta text-muted-foreground"
              : "text-body-sm text-muted-foreground"
          )}
        >
          {description}
        </p>
      )}
      {action && <div className={compact ? "mt-xs" : "mt-md"}>{action}</div>}
    </div>
  );
}
