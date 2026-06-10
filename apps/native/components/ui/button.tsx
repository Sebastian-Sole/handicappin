/**
 * Native Button — mirror of apps/web/components/ui/button.tsx (same CVA
 * recipe, same variant/size names) so screens diff 1:1 against their web
 * twins. Web's hover: states have no touch equivalent; press feedback comes
 * from active: opacity instead.
 */
import { cva, type VariantProps } from "class-variance-authority";
import type { ReactNode } from "react";
import { Pressable, Text, type PressableProps } from "react-native";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "flex-row items-center justify-center rounded-md active:opacity-80 disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary",
        destructive: "bg-destructive",
        outline: "border border-input bg-background",
        secondary: "bg-secondary",
        ghost: "",
        link: "",
      },
      size: {
        default: "h-10 px-md py-sm",
        sm: "h-9 rounded-md px-md",
        lg: "h-11 rounded-md px-xl",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

const buttonTextVariants = cva("text-label-sm", {
  variants: {
    variant: {
      default: "text-primary-foreground",
      destructive: "text-destructive-foreground",
      outline: "text-foreground",
      secondary: "text-secondary-foreground",
      ghost: "text-foreground",
      // Web's link variant underlines on hover only — no underline at rest.
      link: "text-primary",
    },
  },
  defaultVariants: { variant: "default" },
});

export interface ButtonProps
  extends Omit<PressableProps, "children">,
    VariantProps<typeof buttonVariants> {
  className?: string;
  textClassName?: string;
  children: ReactNode;
}

export function Button({
  className,
  textClassName,
  variant,
  size,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled === true }}
      className={cn(buttonVariants({ variant, size, className }))}
      disabled={disabled}
      {...props}
    >
      {typeof children === "string" ? (
        <Text className={cn(buttonTextVariants({ variant }), textClassName)}>
          {children}
        </Text>
      ) : (
        children
      )}
    </Pressable>
  );
}

export { buttonVariants, buttonTextVariants };
