import { cn } from "@/lib/utils";
import type { CSSProperties, ReactNode } from "react";

/**
 * Typography primitives. Sizes, line heights, weights, and tracking come
 * from the `--text-*` CSS variables declared in `app/globals.css`, which
 * mirror `lib/design/tokens.ts`. Consumers should prefer these primitives
 * over raw heading tags; the ESLint config enforces that outside
 * `components/ui/`.
 */

type TypographyProps = {
  children: ReactNode;
  className?: string;
};

type ScaleKey =
  | "display"
  | "h1"
  | "h2"
  | "h3"
  | "h4"
  | "body"
  | "body-sm"
  | "caption";

const scaleStyle = (key: ScaleKey): CSSProperties => ({
  fontSize: `var(--text-${key}-size)`,
  lineHeight: `var(--text-${key}-line-height)`,
  fontWeight: `var(--text-${key}-weight)` as unknown as CSSProperties["fontWeight"],
  letterSpacing: `var(--text-${key}-tracking)`,
});

export function H1({ children, className }: TypographyProps) {
  return (
    <h1
      style={scaleStyle("h1")}
      className={cn("scroll-m-20", className)}
    >
      {children}
    </h1>
  );
}

export function H2({ children, className }: TypographyProps) {
  return (
    <h2
      style={scaleStyle("h2")}
      className={cn(
        "scroll-m-20 pb-2 transition-colors first:mt-0",
        className
      )}
    >
      {children}
    </h2>
  );
}

export function H3({ children, className }: TypographyProps) {
  return (
    <h3 style={scaleStyle("h3")} className={cn("scroll-m-20", className)}>
      {children}
    </h3>
  );
}

export function H4({ children, className }: TypographyProps) {
  return (
    <h4 style={scaleStyle("h4")} className={cn("scroll-m-20", className)}>
      {children}
    </h4>
  );
}

export function P({ children, className }: TypographyProps) {
  return (
    <p
      style={scaleStyle("body")}
      className={cn("not-first:mt-6", className)}
    >
      {children}
    </p>
  );
}

export function Blockquote({ children, className }: TypographyProps) {
  return (
    <blockquote
      style={scaleStyle("body")}
      className={cn("mt-6 border-l-2 pl-6 italic", className)}
    >
      {children}
    </blockquote>
  );
}

export function InlineCode({ children, className }: TypographyProps) {
  return (
    <code
      style={scaleStyle("body-sm")}
      className={cn(
        "relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono font-semibold",
        className
      )}
    >
      {children}
    </code>
  );
}

export function Lead({ children, className }: TypographyProps) {
  return (
    <p
      style={scaleStyle("h4")}
      className={cn("text-muted-foreground font-normal", className)}
    >
      {children}
    </p>
  );
}

export function Large({ children, className }: TypographyProps) {
  return (
    <div
      style={scaleStyle("body")}
      className={cn("text-lg font-semibold", className)}
    >
      {children}
    </div>
  );
}

export function Small({ children, className }: TypographyProps) {
  return (
    <small
      style={scaleStyle("body-sm")}
      className={cn("font-medium leading-none", className)}
    >
      {children}
    </small>
  );
}

export function Muted({ children, className }: TypographyProps) {
  return (
    <p
      style={scaleStyle("body-sm")}
      className={cn("text-muted-foreground", className)}
    >
      {children}
    </p>
  );
}
