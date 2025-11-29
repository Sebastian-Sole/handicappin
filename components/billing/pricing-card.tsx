import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export type PlanTier = "free" | "premium" | "unlimited" | "lifetime";

interface Feature {
  text: string;
  included: boolean;
}

type variantcolor = "default" | "value";

interface PricingCardProps {
  plan: PlanTier;
  price: string | number;
  interval?: "year" | "month" | "once" | "forever";
  title: string;
  description: string;
  features: Feature[];
  badge?: {
    text: string;
    variant?: variantcolor;
  };
  buttonText: string;
  onButtonClick?: () => void;
  buttonDisabled?: boolean;
  buttonVariant?: "default" | "outline";
  highlighted?: boolean;
  currentPlan?: boolean;
  className?: string;
  costComparison?: string;
  originalPrice?: string | number;
  slotsRemaining?: number;
}

const badgeColors = {
  default: "bg-primary",
  value: "bg-primary",
  // launch: "bg-accent",
};

const borderColors = {
  default: "border",
  primary: "border-2 border-primary",
  // launch: "border-2 border-accent",
};

function getBorderClass(
  highlighted: boolean,
  plan: PlanTier,
  currentPlan: boolean,
  badgeVariant?: variantcolor
): string {
  // Only highlighted cards get borders
  if (!highlighted) {
    return "none";
  }
  // Value badge always gets primary border
  if (badgeVariant === "value" && highlighted) {
    return borderColors.primary;
  }

  // Lifetime plan gets primary border
  if (plan === "lifetime") {
    return borderColors.primary;
  }

  // Free plan gets primary border if not the current plan
  if (plan === "free" && !currentPlan) {
    return borderColors.primary;
  }

  // Default border for other highlighted cards
  return borderColors.default;
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
  onButtonClick,
  buttonDisabled = false,
  buttonVariant = "default",
  highlighted = false,
  currentPlan = false,
  className = "",
  costComparison,
  originalPrice,
  slotsRemaining,
}: PricingCardProps) {
  const borderClass = getBorderClass(
    highlighted,
    plan,
    currentPlan,
    badge?.variant
  );

  const shadowClass = highlighted
    ? "shadow-lg hover:shadow-xl"
    : "shadow-md hover:shadow-lg";

  return (
    <Card
      className={`${borderClass} rounded-lg p-8 ${shadowClass} transition relative dark:bg-primary/10 ${className} flex flex-col h-full`}
    >
      {badge && (
        <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
          <Badge
            className={`${
              badge.variant ? badgeColors[badge.variant] : "bg-gray-500"
            } text-white px-4 py-1 rounded-full text-sm font-semibold whitespace-nowrap min-h-6 flex items-center`}
          >
            {badge.text}
          </Badge>
        </div>
      )}

      <div className="mb-4">
        <h2 className="text-2xl font-bold mb-2">{title}</h2>
        {/* {badge && plan === "free" && (
          <p className="text-xs text-muted-foreground">
            First 100 users, forever
          </p>
        )} */}
        <p className="text-gray-600 mt-2 mb-4">{description}</p>
        {slotsRemaining !== undefined && slotsRemaining !== null && (
          <p className="text-sm font-semibold text-destructive mb-2">
            {slotsRemaining > 0
              ? `${slotsRemaining} slot${slotsRemaining !== 1 ? "s" : ""} left!`
              : "All slots claimed"}
          </p>
        )}
        <div className="mb-4">
          <div>
            {originalPrice && (
              <span className="text-lg text-muted-foreground line-through mr-2">
                {typeof originalPrice === "number"
                  ? `$${originalPrice}`
                  : originalPrice}
              </span>
            )}
            <span className="text-3xl font-bold">
              {typeof price === "number" ? `$${price}` : price}
            </span>
            <span className="text-lg text-gray-600">
              {interval === "year" && "/year"}
              {interval === "month" && "/mo"}
              {interval === "once" && " once"}
              {interval === "forever" && "/forever"}
            </span>
          </div>
          {costComparison && (
            <p className="text-xs text-muted-foreground mt-1 italic">
              {costComparison}
            </p>
          )}
        </div>
      </div>

      <div className="flex-grow flex flex-col justify-between">
        <ul className="space-y-3 mb-8">
          {features.map((feature, index) => (
            <li key={index} className="flex items-start">
              {feature.included ? (
                <span className="text-green-500 mr-2">✓</span>
              ) : (
                <span className="text-red-500 mr-2">✗</span>
              )}
              <span className={feature.included ? "" : "text-gray-400"}>
                {feature.text}
              </span>
            </li>
          ))}
        </ul>

        <Button
          onClick={onButtonClick}
          disabled={buttonDisabled}
          className={`w-full`}
          variant={buttonVariant}
        >
          {buttonText}
        </Button>
      </div>
    </Card>
  );
}

export function PricingCardSkeleton() {
  return (
    <Card className="rounded-lg p-8 shadow-md flex flex-col h-full">
      {/* Badge skeleton */}
      <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
        <Skeleton className="h-6 w-24 rounded-full" />
      </div>

      <div className="mb-4">
        {/* Title */}
        <Skeleton className="h-8 w-32 mb-2" />

        {/* Description */}
        <Skeleton className="h-4 w-full mt-2 mb-2" />
        <Skeleton className="h-4 w-3/4 mb-4" />

        {/* Price */}
        <div className="mb-4">
          <Skeleton className="h-10 w-40" />
        </div>
      </div>

      <div className="flex-grow flex flex-col justify-between">
        {/* Features */}
        <ul className="space-y-3 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <li key={i} className="flex items-start">
              <Skeleton className="h-4 w-4 mr-2 rounded-full flex-shrink-0" />
              <Skeleton className="h-4 flex-1" />
            </li>
          ))}
        </ul>

        {/* Button */}
        <Skeleton className="h-10 w-full rounded-md" />
      </div>
    </Card>
  );
}
