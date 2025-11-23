import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
    variant?: "default" | "success" | "primary";
  };
  buttonText: string;
  onButtonClick?: () => void;
  buttonDisabled?: boolean;
  buttonVariant?: "default" | "outline";
  highlighted?: boolean;
  currentPlan?: boolean;
  className?: string;
}

const badgeColors = {
  default: "bg-gray-500",
  success: "bg-green-500",
  primary: "bg-blue-500",
};

const borderColors = {
  default: "border",
  highlighted: "border-2 border-blue-500",
  success: "border-2 border-green-500",
  primary: "border-2 border-primary",
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
}: PricingCardProps) {
  const borderClass = highlighted
    ? plan === "lifetime"
      ? borderColors.success
      : borderColors.highlighted
    : plan === "free" && !currentPlan
    ? borderColors.primary
    : borderColors.default;

  const shadowClass = highlighted ? "shadow-lg hover:shadow-xl" : "shadow-md hover:shadow-lg";

  return (
    <Card className={`${borderClass} rounded-lg p-8 ${shadowClass} transition relative dark:bg-primary/10 ${className} flex flex-col h-full`}>
      {badge && (
        <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
          <Badge
            className={`${badge.variant ? badgeColors[badge.variant] : "bg-gray-500"} text-white px-4 py-1 rounded-full text-sm font-semibold whitespace-nowrap min-h-6 flex items-center`}
          >
            {badge.text}
          </Badge>
        </div>
      )}

      <div className="mb-4">
        <h2 className="text-2xl font-bold mb-2">{title}</h2>
        {badge && plan === "free" && (
          <p className="text-xs text-muted-foreground">First 100 users, forever</p>
        )}
        {!badge && (
          <p className="text-xs text-muted-foreground invisible">Hidden</p>
        )}
        <p className="text-gray-600 mt-2 mb-4">{description}</p>
        <div className="mb-4">
          <span className="text-3xl font-bold">
            {typeof price === "number" ? `$${price}` : price}
          </span>
          <span className="text-lg text-gray-600 text-muted-foreground">
            {interval === "year" && "/year"}
            {interval === "month" && "/mo"}
            {interval === "once" && " once"}
            {interval === "forever" && "/forever"}
          </span>
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
          className={`w-full ${
            plan === "lifetime" && !currentPlan
              ? "bg-green-600 hover:bg-green-700"
              : ""
          }`}
          variant={buttonVariant}
        >
          {buttonText}
        </Button>
      </div>
    </Card>
  );
}
