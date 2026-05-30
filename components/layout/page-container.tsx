import { cn } from "@/lib/utils";

/**
 * Shared page shell for authenticated app pages.
 *
 * Establishes a single container width (`max-w-6xl`, per remediation decision D1)
 * and the page-level vertical/horizontal rhythm so the content frame no longer
 * reflows between routes. Marketing, auth, and legal pages keep their own widths
 * and should NOT use this component.
 *
 * Server-safe (no "use client").
 */
export function PageContainer({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("container mx-auto px-md py-3xl sm:px-lg lg:px-xl", className)}>
      {children}
    </div>
  );
}
