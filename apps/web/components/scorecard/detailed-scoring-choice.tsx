"use client";

/**
 * Round-start choice (plan 013 D3): Track detailed stats vs Scores only,
 * pre-selected from the Settings default, with "Remember my choice".
 * Mirrored at apps/native/components/scorecard/detailed-scoring-choice.tsx.
 */
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface DetailedScoringChoiceProps {
  /** true = track detailed stats for this round. */
  value: boolean;
  onChange: (value: boolean) => void;
  remember: boolean;
  onRememberChange: (value: boolean) => void;
  disabled?: boolean;
}

function ChoiceButton({
  selected,
  icon,
  title,
  subtitle,
  disabled,
  onSelect,
}: {
  selected: boolean;
  icon: string;
  title: string;
  subtitle: string;
  disabled?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-md rounded-lg border p-md text-left disabled:opacity-50",
        selected
          ? "border-primary bg-accent"
          : "border-border hover:border-primary"
      )}
    >
      <span
        aria-hidden
        className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background-alternate"
      >
        {icon}
      </span>
      <span>
        <span className="block text-body-sm font-medium">{title}</span>
        <span className="block text-meta text-muted-foreground">
          {subtitle}
        </span>
      </span>
    </button>
  );
}

export function DetailedScoringChoice({
  value,
  onChange,
  remember,
  onRememberChange,
  disabled,
}: DetailedScoringChoiceProps) {
  return (
    <div className="space-y-sm">
      <div
        role="radiogroup"
        aria-label="Detail tracking for this round"
        className="space-y-sm"
      >
        <ChoiceButton
          selected={value}
          icon="📊"
          title="Track detailed stats"
          subtitle="Putts, fairways & penalties per hole"
          disabled={disabled}
          onSelect={() => onChange(true)}
        />
        <ChoiceButton
          selected={!value}
          icon="⛳"
          title="Scores only"
          subtitle="Just strokes — fastest"
          disabled={disabled}
          onSelect={() => onChange(false)}
        />
      </div>
      <div className="flex items-center gap-sm">
        <Checkbox
          id="remember-detailed-choice"
          checked={remember}
          disabled={disabled}
          onCheckedChange={(checked) => onRememberChange(checked === true)}
        />
        <Label
          htmlFor="remember-detailed-choice"
          className="text-body-sm text-muted-foreground font-normal"
        >
          Remember my choice (change in Settings)
        </Label>
      </div>
    </div>
  );
}
