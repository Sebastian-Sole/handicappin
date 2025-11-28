import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export type PlanTier = "free" | "premium" | "unlimited" | "lifetime";

interface Feature {
  text: string;
  included: boolean;
}

interface PricingCardProps {
  plan: PlanTier;
  price: string | number;
  interval?: "year" | "month" | "once" | "forever";
  title: string;
  description: string;
  features: Feature[];
  badge?: {
    text: string;
    variant?: "default" | "primary" | "value" | "launch";
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
  default: "bg-accent",
  primary: "bg-primary",
  value: "bg-primary",
  launch: "bg-accent",
};

const borderColors = {
  default: "border",
  primary: "border-2 border-primary",
  launch: "border-2 border-accent",
};

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
  const borderClass = highlighted
    ? plan === "lifetime"
      ? borderColors.launch
      : plan === "free" && !currentPlan
      ? borderColors.primary
      : badge?.variant === "value"
      ? borderColors.primary
      : borderColors.default
    : badge?.variant === "value"
    ? borderColors.primary
    : "none";

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
        {!badge && <div className="h-4" aria-hidden="true" />}
        <p className="text-gray-600 mt-2 mb-4">{description}</p>
        {slotsRemaining !== undefined && slotsRemaining !== null && (
          <p className="text-sm font-semibold text-primary mb-2">
            {slotsRemaining > 0
              ? `${slotsRemaining} slot${slotsRemaining !== 1 ? "s" : ""} left!`
              : "All slots claimed"}
          </p>
        )}
        <div className="mb-4">
          {originalPrice && (
            <div className="mb-1">
              <span className="text-lg text-muted-foreground line-through">
                {typeof originalPrice === "number"
                  ? `$${originalPrice}`
                  : originalPrice}
              </span>
            </div>
          )}
          <div>
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
          className={`w-full ${plan == "lifetime" && "bg-accent"}`}
          variant={buttonVariant}
        >
          {buttonText}
        </Button>
      </div>
    </Card>
  );
}
