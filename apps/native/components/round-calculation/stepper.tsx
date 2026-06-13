/**
 * Native CalculationStepper — mirror of apps/web/components/ui/
 * calculation-stepper.tsx (numbered circles joined by lines + labels).
 *
 * Geometry: connectors are SIBLINGS between the circle+label columns, not
 * children of them — wrapped in an h-10 box (the circle height) with
 * justify-center so each line meets both neighboring circles at their
 * vertical center. Nesting half-lines inside each step leaves gaps over
 * the next step's leading edge (the bug the owner reported).
 */
import { Fragment } from "react";
import { Text, View } from "react-native";

interface Step {
  id: number;
  title: string;
}

export function CalculationStepper({ steps }: { steps: Step[] }) {
  return (
    <View
      accessibilityLabel="Calculation steps"
      className="flex-row items-start justify-between py-md"
    >
      {steps.map((step, index) => (
        <Fragment key={step.id}>
          {index > 0 ? (
            <View className="flex-1 h-10 justify-center">
              <View className="h-0.5 bg-muted mx-sm" />
            </View>
          ) : null}
          <View className="items-center max-w-20">
            <View className="w-10 h-10 rounded-full bg-muted items-center justify-center">
              <Text className="text-badge text-muted-foreground">
                {step.id}
              </Text>
            </View>
            <Text className="mt-sm text-meta text-muted-foreground text-center">
              {step.title}
            </Text>
          </View>
        </Fragment>
      ))}
    </View>
  );
}
