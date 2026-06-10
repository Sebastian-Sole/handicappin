/**
 * Native CalculationStep — mirror of apps/web/components/round/calculation/
 * calculation-step.tsx: numbered chip, title/description, content, and a
 * collapsible learn-more (no IntersectionObserver entrance animation — RN).
 */
import { ChevronDown } from "lucide-react-native";
import { useState, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

import { tokens } from "@handicappin/tokens/tokens";
import { useColorMode } from "@/lib/color-mode";
import { cn } from "@/lib/utils";

const ICON_SIZE = 16; // allow-hardcoded lucide icon prop mirrors web's fixed h-4 w-4 icon box

interface CalculationStepProps {
  stepNumber: number;
  title: string;
  description?: string;
  learnMoreContent?: ReactNode;
  children: ReactNode;
}

export function CalculationStep({
  stepNumber,
  title,
  description,
  learnMoreContent,
  children,
}: CalculationStepProps) {
  const mode = useColorMode();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <View className="gap-md" testID={`calc-step-${stepNumber}`}>
      <View className="flex-row items-start gap-md">
        <View className="w-8 h-8 rounded-full bg-primary items-center justify-center">
          <Text className="text-badge text-primary-foreground">
            {stepNumber}
          </Text>
        </View>
        <View className="flex-1">
          <Text className="text-heading-3 text-foreground">{title}</Text>
          {description ? (
            <Text className="text-body-sm text-muted-foreground mt-xs">
              {description}
            </Text>
          ) : null}
        </View>
      </View>

      <View>{children}</View>

      {learnMoreContent ? (
        <View>
          <Pressable
            accessibilityRole="button"
            onPress={() => setIsOpen((open) => !open)}
            className="flex-row items-center gap-sm"
          >
            <View className={cn(isOpen && "rotate-180")}>
              <ChevronDown
                size={ICON_SIZE}
                color={tokens.colors[mode]["muted-foreground"]}
              />
            </View>
            <Text className="text-body-sm text-muted-foreground">
              {isOpen ? "Hide" : "Learn more about"} this calculation
            </Text>
          </Pressable>
          {isOpen ? <View className="mt-md gap-sm">{learnMoreContent}</View> : null}
        </View>
      ) : null}
    </View>
  );
}
