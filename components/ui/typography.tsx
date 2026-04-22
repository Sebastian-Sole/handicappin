import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type TypographyProps = {
  children: ReactNode;
  className?: string;
};

export function H1({ children, className }: TypographyProps) {
  return (
    <h1 className={cn("text-heading-1 scroll-m-20", className)}>{children}</h1>
  );
}

export function H2({ children, className }: TypographyProps) {
  return (
    <h2
      className={cn(
        "text-heading-2 scroll-m-20 pb-sm transition-colors first:mt-0",
        className
      )}
    >
      {children}
    </h2>
  );
}

export function H3({ children, className }: TypographyProps) {
  return (
    <h3 className={cn("text-heading-3 scroll-m-20", className)}>{children}</h3>
  );
}

export function H4({ children, className }: TypographyProps) {
  return (
    <h4 className={cn("text-heading-4 scroll-m-20", className)}>{children}</h4>
  );
}

export function P({ children, className }: TypographyProps) {
  return (
    <p className={cn("text-body not-first:mt-lg", className)}>{children}</p>
  );
}

export function Blockquote({ children, className }: TypographyProps) {
  return (
    <blockquote
      className={cn("text-body mt-lg border-l-2 pl-lg italic", className)}
    >
      {children}
    </blockquote>
  );
}

export function InlineCode({ children, className }: TypographyProps) {
  return (
    <code
      className={cn(
        "text-body-sm relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono font-semibold",
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
      className={cn(
        "text-heading-4 text-muted-foreground font-normal",
        className
      )}
    >
      {children}
    </p>
  );
}

export function Large({ children, className }: TypographyProps) {
  return (
    <div className={cn("text-body text-lg font-semibold", className)}>
      {children}
    </div>
  );
}

export function Small({ children, className }: TypographyProps) {
  return (
    <small className={cn("text-body-sm font-medium leading-none", className)}>
      {children}
    </small>
  );
}

export function Muted({ children, className }: TypographyProps) {
  return (
    <p className={cn("text-body-sm text-muted-foreground", className)}>
      {children}
    </p>
  );
}
