import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { H2 } from "@/components/ui/typography";

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
};

const borderColors = {
  default: "border",
  primary: "border-2 border-primary",
};

function getBorderClass(
  highlighted: boolean,
  plan: PlanTier,
  currentPlan: boolean,
  badgeVariant?: variantcolor
): string {
  // Only highlighted cards get borders
  if (!highlighted) {
    return "";
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
      className={`${borderClass} rounded-lg p-xl ${shadowClass} transition relative dark:bg-primary/10 ${className} flex flex-col h-full`}
    >
      {badge && (
        <div className="absolute -top-md left-1/2 transform -translate-x-1/2">
          <Badge
            className={`${
              badge.variant ? badgeColors[badge.variant] : "bg-muted-foreground"
            } text-primary-foreground px-md py-xs rounded-full text-sm font-semibold whitespace-nowrap min-h-6 flex items-center`}
          >
            {badge.text}
          </Badge>
        </div>
      )}

      <div className="mb-md">
        <H2 className="text-2xl mb-sm pb-0">{title}</H2>
        {/* {badge && plan === "free" && (
          <p className="text-xs text-muted-foreground">
            First 100 users, forever
          </p>
        )} */}
        <p className="text-muted-foreground mt-sm mb-md">{description}</p>
        {slotsRemaining !== undefined && slotsRemaining !== null && (
          <p className="text-sm font-semibold text-destructive mb-sm">
            {slotsRemaining > 0
              ? `${slotsRemaining} slot${slotsRemaining !== 1 ? "s" : ""} left!`
              : "All slots claimed"}
          </p>
        )}
        <div className="mb-md">
          <div>
            {originalPrice && (
              <span className="text-lg text-muted-foreground line-through mr-sm">
                {typeof originalPrice === "number"
                  ? `$${originalPrice}`
                  : originalPrice}
              </span>
            )}
            <span className="text-3xl font-bold">
              {typeof price === "number" ? `$${price}` : price}
            </span>
            <span className="text-lg text-muted-foreground">
              {interval === "year" && "/year"}
              {interval === "month" && "/mo"}
              {interval === "once" && " once"}
              {interval === "forever" && "/forever"}
            </span>
          </div>
          {costComparison && (
            <p className="text-xs text-muted-foreground mt-xs italic">
              {costComparison}
            </p>
          )}
        </div>
      </div>

      <div className="flex-grow flex flex-col justify-between">
        <ul className="space-y-sm mb-xl">
          {features.map((feature, index) => (
            <li key={index} className="flex items-start">
              {feature.included ? (
                <span className="text-success mr-sm">✓</span>
              ) : (
                <span className="text-destructive mr-sm">✗</span>
              )}
              <span className={feature.included ? "" : "text-muted-foreground/70"}>
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
    <Card className="rounded-lg p-xl shadow-md flex flex-col h-full">
      {/* Badge skeleton */}
      <div className="absolute -top-md left-1/2 transform -translate-x-1/2">
        <Skeleton className="h-6 w-24 rounded-full" />
      </div>

      <div className="mb-md">
        {/* Title */}
        <Skeleton className="h-8 w-32 mb-sm" />

        {/* Description */}
        <Skeleton className="h-4 w-full mt-sm mb-sm" />
        <Skeleton className="h-4 w-3/4 mb-md" />

        {/* Price */}
        <div className="mb-md">
          <Skeleton className="h-10 w-40" />
        </div>
      </div>

      <div className="flex-grow flex flex-col justify-between">
        {/* Features */}
        <ul className="space-y-sm mb-xl">
          {[1, 2, 3, 4].map((i) => (
            <li key={i} className="flex items-start">
              <Skeleton className="h-4 w-4 mr-sm rounded-full flex-shrink-0" />
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
