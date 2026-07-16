/**
 * Round-start choice (plan 013 D3) — native mirror of
 * apps/web/components/scorecard/detailed-scoring-choice.tsx: Track detailed
 * stats vs Scores only, pre-selected from the Settings default, with
 * "Remember my choice".
 */
import { Pressable, Text, View } from "react-native";

import { Checkbox } from "@/components/ui/checkbox";
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
  testID,
  disabled,
  onSelect,
}: {
  selected: boolean;
  icon: string;
  title: string;
  subtitle: string;
  testID: string;
  disabled?: boolean;
  onSelect: () => void;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, disabled: disabled === true }}
      accessibilityLabel={`${title}. ${subtitle}`}
      disabled={disabled}
      onPress={onSelect}
      className={cn(
        "w-full flex-row items-center gap-md rounded-lg border p-md active:opacity-80",
        selected ? "border-primary bg-accent" : "border-border",
        disabled && "opacity-50",
      )}
    >
      <View className="h-9 w-9 items-center justify-center rounded-md border border-border bg-background-alternate">
        <Text className="text-body">{icon}</Text>
      </View>
      <View className="flex-1">
        <Text className="text-body-sm font-medium text-foreground">
          {title}
        </Text>
        <Text className="text-meta text-muted-foreground">{subtitle}</Text>
      </View>
    </Pressable>
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
    <View className="gap-sm">
      <ChoiceButton
        selected={value}
        icon="📊"
        title="Track detailed stats"
        subtitle="Putts, fairways & penalties per hole"
        testID="choice-detailed"
        disabled={disabled}
        onSelect={() => onChange(true)}
      />
      <ChoiceButton
        selected={!value}
        icon="⛳"
        title="Scores only"
        subtitle="Just strokes — fastest"
        testID="choice-scores-only"
        disabled={disabled}
        onSelect={() => onChange(false)}
      />
      <View className="flex-row items-center gap-sm">
        <Checkbox
          testID="remember-detailed-choice"
          accessibilityLabel="Remember my choice"
          checked={remember}
          onCheckedChange={(checked) => {
            if (!disabled) onRememberChange(checked);
          }}
        />
        <Text className="text-body-sm text-muted-foreground">
          Remember my choice (change in Settings)
        </Text>
      </View>
    </View>
  );
}
