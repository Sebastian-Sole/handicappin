"use client";

import { Button, ButtonProps } from "@/components/ui/button";
import { Loader2, Check } from "lucide-react";
import { cn } from "@/lib/utils";

type ButtonState = "idle" | "loading" | "success" | "error";

interface SubmitButtonProps extends Omit<ButtonProps, "children"> {
  state: ButtonState;
  idleText: string;
  loadingText: string;
  successText?: string;
  errorText?: string;
}

export function SubmitButton({
  state,
  idleText,
  loadingText,
  successText = "Done!",
  errorText = "Try Again",
  className,
  disabled,
  ...props
}: SubmitButtonProps) {
  const isDisabled = state === "loading" || state === "success" || disabled;

  return (
    <Button
      {...props}
      disabled={isDisabled}
      className={cn(
        "transition-all duration-300",
        state === "success" && "bg-green-600 hover:bg-green-600",
        state === "error" && "bg-destructive hover:bg-destructive",
        className
      )}
    >
      {state === "loading" && (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          {loadingText}
        </>
      )}
      {state === "success" && (
        <>
          <Check className="mr-2 h-4 w-4" />
          {successText}
        </>
      )}
      {state === "error" && errorText}
      {state === "idle" && idleText}
    </Button>
  );
}
