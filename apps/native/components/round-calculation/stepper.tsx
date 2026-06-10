/**
 * Native CalculationStepper — mirror of apps/web/components/ui/
 * calculation-stepper.tsx (numbered circles joined by lines + labels).
 */
import { Text, View } from "react-native";

interface Step {
  id: number;
  title: string;
}

export function CalculationStepper({ steps }: { steps: Step[] }) {
  return (
    <View
      accessibilityLabel="Calculation steps"
      className="flex-row items-start py-md"
    >
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        return (
          <View
            key={step.id}
            className={isLast ? "items-center" : "flex-1 items-center"}
          >
            <View className="flex-row items-center w-full">
              {/* leading spacer keeps circles centered over labels */}
              <View className="flex-1" />
              <View className="w-10 h-10 rounded-full bg-muted items-center justify-center">
                <Text className="text-badge text-muted-foreground">
                  {step.id}
                </Text>
              </View>
              <View className="flex-1">
                {!isLast ? <View className="h-0.5 bg-muted w-full" /> : null}
              </View>
            </View>
            <Text className="mt-sm text-meta text-muted-foreground text-center">
              {step.title}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
