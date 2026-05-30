import { cn } from "@/lib/utils";

/**
 * Shared page shell for authenticated app pages.
 *
 * Width recipe is `sm:container mx-auto px-md lg:px-lg` — copied verbatim from
 * the homepage's section wrappers (`components/homepage/home-page.tsx`,
 * `components/homepage/hero.tsx`) so authenticated pages don't render at a
 * narrower content width than the homepage. `py-3xl` bakes in the page-level
 * vertical rhythm.
 *
 * Marketing, auth, and legal pages keep their own widths and should NOT use
 * this component.
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
    <div
      className={cn(
        "sm:container mx-auto px-md py-3xl lg:px-lg",
        className,
      )}
    >
      {children}
    </div>
  );
}
