import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Card density.
 *
 * - `default`: standard padding (`p-lg`) on header/content/footer.
 * - `compact`: tighter padding (`p-md`). A single named choice for
 *   information-dense surfaces (e.g. the statistics domain) so callers
 *   opt in via `density="compact"` instead of overriding padding inline.
 */
type CardDensity = "default" | "compact";

const cardHeaderVariants = cva("flex flex-col space-y-xs", {
  variants: {
    density: {
      default: "p-lg",
      compact: "p-md",
    },
  },
  defaultVariants: {
    density: "default",
  },
});

const cardContentVariants = cva("pt-0", {
  variants: {
    density: {
      default: "p-lg",
      compact: "p-md",
    },
  },
  defaultVariants: {
    density: "default",
  },
});

const cardFooterVariants = cva("flex items-center pt-0", {
  variants: {
    density: {
      default: "p-lg",
      compact: "p-md",
    },
  },
  defaultVariants: {
    density: "default",
  },
});

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-lg border bg-card text-card-foreground shadow-xs",
      className
    )}
    {...props}
  />
));
Card.displayName = "Card";

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> &
    VariantProps<typeof cardHeaderVariants>
>(({ className, density, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(cardHeaderVariants({ density }), className)}
    {...props}
  />
));
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn("text-heading-4", className)}
    {...props}
  />
));
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-body-sm text-muted-foreground", className)}
    {...props}
  />
));
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> &
    VariantProps<typeof cardContentVariants>
>(({ className, density, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(cardContentVariants({ density }), className)}
    {...props}
  />
));
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> &
    VariantProps<typeof cardFooterVariants>
>(({ className, density, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(cardFooterVariants({ density }), className)}
    {...props}
  />
));
CardFooter.displayName = "CardFooter";

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
};
export type { CardDensity };
