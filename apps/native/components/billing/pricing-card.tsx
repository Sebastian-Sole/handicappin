/**
 * Native PricingCard — mirror of apps/web/components/billing/pricing-card.tsx
 * (badge floating over the top edge, title/description/price block, feature
 * checklist, full-width CTA).
 */
import type { ReactNode } from "react";
import { Text, View } from "react-native";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { H2 } from "@/components/ui/typography";
import type { PlanFeature } from "@/lib/billing/plan-content";
import { cn } from "@/lib/utils";

export type PlanTier = "free" | "premium" | "unlimited" | "lifetime";

interface PricingCardProps {
  plan: PlanTier;
  price: string | number;
  interval?: "year" | "month" | "once" | "forever";
  title: string;
  description: string;
  features: PlanFeature[];
  badge?: { text: string; variant?: "default" | "value" };
  buttonText: string;
  onButtonPress?: () => void;
  buttonDisabled?: boolean;
  buttonVariant?: "default" | "outline";
  highlighted?: boolean;
  currentPlan?: boolean;
  costComparison?: string;
  originalPrice?: string | number;
  slotsRemaining?: number;
  testID?: string;
}

const INTERVAL_SUFFIX: Record<string, string> = {
  year: "/year",
  month: "/mo",
  once: " once",
  forever: "/forever",
};

function borderClass(
  highlighted: boolean,
  plan: PlanTier,
  currentPlan: boolean,
  badgeVariant?: "default" | "value",
): string {
  if (!highlighted) return "";
  if (badgeVariant === "value") return "border-2 border-primary";
  if (plan === "lifetime") return "border-2 border-primary";
  if (plan === "free" && !currentPlan) return "border-2 border-primary";
  return "border";
}

export function PricingCard({
  plan,
  price,
  interval = "year",
  title,
  description,
  features,
  badge,
  buttonText,
  onButtonPress,
  buttonDisabled = false,
  buttonVariant = "default",
  highlighted = false,
  currentPlan = false,
  costComparison,
  originalPrice,
  slotsRemaining,
  testID,
}: PricingCardProps) {
  const border = borderClass(highlighted, plan, currentPlan, badge?.variant);

  let priceLine: ReactNode = (
    <View className="flex-row items-baseline">
      {originalPrice != null ? (
        <Text className="text-body text-muted-foreground line-through mr-sm">
          {typeof originalPrice === "number"
            ? `$${originalPrice}`
            : originalPrice}
        </Text>
      ) : null}
      <Text className="text-figure-lg text-foreground">
        {typeof price === "number" ? `$${price}` : price}
      </Text>
      <Text className="text-body text-muted-foreground">
        {INTERVAL_SUFFIX[interval]}
      </Text>
    </View>
  );

  return (
    <View testID={testID} className="pt-md">
      <Card className={cn("relative", border)}>
        {badge ? (
          <View className="absolute -top-md left-0 right-0 items-center z-10">
            <Badge
              className={cn(
                badge.variant ? "bg-primary" : "bg-muted-foreground",
                "px-md py-xs",
              )}
            >
              {badge.text}
            </Badge>
          </View>
        ) : null}

        <CardContent className="pt-lg">
          <View className="mb-md">
            <H2 className="mb-sm pb-0">{title}</H2>
            <Text className="text-body text-muted-foreground mt-sm mb-md">
              {description}
            </Text>
            {slotsRemaining !== undefined ? (
              <Text className="text-badge text-destructive mb-sm">
                {slotsRemaining > 0
                  ? `${slotsRemaining} slot${slotsRemaining !== 1 ? "s" : ""} left!`
                  : "All slots claimed"}
              </Text>
            ) : null}
            <View className="mb-md">
              {priceLine}
              {costComparison ? (
                <Text className="text-meta text-muted-foreground mt-xs italic">
                  {costComparison}
                </Text>
              ) : null}
            </View>
          </View>

          <View className="gap-sm mb-xl">
            {features.map((feature) => (
              <View key={feature.text} className="flex-row items-start">
                <Text
                  className={cn(
                    "mr-sm text-body",
                    feature.included ? "text-success" : "text-destructive",
                  )}
                >
                  {feature.included ? "✓" : "✗"}
                </Text>
                <Text
                  className={cn(
                    "text-body flex-1",
                    feature.included
                      ? "text-foreground"
                      : "text-muted-foreground",
                  )}
                >
                  {feature.text}
                </Text>
              </View>
            ))}
          </View>

          <Button
            testID={testID ? `${testID}-cta` : undefined}
            onPress={onButtonPress}
            disabled={buttonDisabled}
            className="w-full"
            variant={buttonVariant}
          >
            {buttonText}
          </Button>
        </CardContent>
      </Card>
    </View>
  );
}
