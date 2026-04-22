"use client";
import Link from "next/link";
import { AlertCircle, TrendingUp, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Progress } from "../ui/progress";
import { H1, H3 } from "../ui/typography";

interface UsageLimitAlertProps {
  current: number;
  total: number;
  resourceName?: string;
  variant?: "default" | "warning" | "critical";
  onUpgrade?: () => void;
}

export function UsageLimitAlert({
  current,
  total,
  resourceName = "rounds",
  variant = "default",
  onUpgrade,
}: UsageLimitAlertProps) {
  const percentage = (current / total) * 100;
  const remaining = total - current;

  const handleUpgrade = () => {
    if (onUpgrade) {
      onUpgrade();
    } else {
      window.location.href = "/upgrade";
    }
  };

  const variantStyles = {
    default: {
      container: "surface",
      icon: "text-primary",
      progress: "bg-primary",
      button: "bg-primary text-primary-foreground hover:bg-primary/90",
    },
    warning: {
      container: "tint-warning",
      icon: "text-warning",
      progress: "bg-warning",
      button:
        "bg-warning text-warning-foreground hover:bg-warning/90",
    },
    critical: {
      container: "tint-destructive",
      icon: "text-destructive",
      progress: "bg-destructive",
      button:
        "bg-destructive text-destructive-foreground hover:bg-destructive/90",
    },
  };

  const styles = variantStyles[variant];

  return (
    <div
      className={cn(
        "p-lg shadow-sm transition-all",
        styles.container
      )}
    >
      <div className="flex flex-col gap-md md:flex-row md:items-center md:justify-between">
        <div className="flex-1 space-y-sm">
          <div className="flex items-start gap-sm">
            <div className={cn("mt-0.5", styles.icon)}>
              {variant === "critical" ? (
                <AlertCircle className="h-5 w-5" />
              ) : variant === "warning" ? (
                <TrendingUp className="h-5 w-5" />
              ) : (
                <Zap className="h-5 w-5" />
              )}
            </div>
            <div className="flex-1 space-y-xs">
              <H3 className="text-pretty font-semibold leading-tight">
                {variant === "critical"
                  ? "Almost at your limit"
                  : variant === "warning"
                  ? "Approaching your limit"
                  : "Usage Limit"}
              </H3>
              <p className="text-pretty text-sm text-muted-foreground">
                You have{" "}
                <span className="font-semibold text-foreground">
                  {remaining} out of {total}
                </span>{" "}
                {resourceName} remaining
              </p>
            </div>
          </div>

          <div className="space-y-sm">
            <Progress value={percentage} className="h-2" />
            <p className="text-xs text-muted-foreground">
              {percentage.toFixed(0)}% used
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center">
          <Button
            onClick={handleUpgrade}
            className={cn("w-full md:w-auto", styles.button)}
            size="default"
          >
            Upgrade Plan
          </Button>
        </div>
      </div>
    </div>
  );
}

export function UsageLimitReachedView() {
  return (
    <div className="flex items-center justify-center min-h-[80vh] py-xl">
      <div className="w-full max-w-md text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-lg">
          <Zap className="w-8 h-8 text-muted-foreground" />
        </div>
        <H1 className="text-4xl md:text-5xl font-bold mb-md text-balance">
          You&apos;ve reached your round limit
        </H1>
        <p className="text-lg text-muted-foreground mb-xl text-pretty">
          You&apos;ve used all of your available rounds. Upgrade to continue
          tracking your golf game!
        </p>
        <Button asChild size="lg" className="w-full sm:w-auto">
          <Link href="/upgrade">Upgrade Now</Link>
        </Button>
      </div>
    </div>
  );
}
