import { Check, Loader2, type LucideIcon } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type SaveState = "idle" | "saving" | "saved" | "error";

type SaveStateButtonProps = Omit<ButtonProps, "children"> & {
  state: SaveState;
  idleLabel: string;
  savingLabel?: string;
  savedLabel?: string;
  errorLabel?: string;
  /** Optional leading icon for the idle/error states (not rendered while
   *  saving or saved — those have their own spinner / check). */
  idleIcon?: LucideIcon;
};

/**
 * Button that reflects a save lifecycle (idle → saving → saved → idle).
 * Replaces the ~6 hand-rolled instances across profile / data-export /
 * settings where a Button toggled to a green "Saved!" state on success.
 *
 * Consumer owns state transitions; this component only renders them.
 */
export function SaveStateButton({
  state,
  idleLabel,
  savingLabel = "Saving...",
  savedLabel = "Saved!",
  errorLabel = "Try again",
  idleIcon: IdleIcon,
  className,
  disabled,
  ...rest
}: SaveStateButtonProps) {
  const isSaved = state === "saved";
  const isBusy = state === "saving";
  const isIdleOrError = !isSaved && !isBusy;

  return (
    <Button
      {...rest}
      disabled={disabled || isBusy}
      className={cn(
        isSaved && "bg-success text-success-foreground hover:bg-success",
        className
      )}
      aria-live="polite"
    >
      {isBusy && <Loader2 className="mr-sm h-4 w-4 animate-spin" aria-hidden />}
      {isSaved && <Check className="mr-sm h-4 w-4" aria-hidden />}
      {isIdleOrError && IdleIcon && (
        <IdleIcon className="mr-sm h-4 w-4" aria-hidden />
      )}
      {isBusy
        ? savingLabel
        : isSaved
          ? savedLabel
          : state === "error"
            ? errorLabel
            : idleLabel}
    </Button>
  );
}
