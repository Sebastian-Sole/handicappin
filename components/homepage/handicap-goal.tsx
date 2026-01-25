import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Target } from "lucide-react";
import { cn } from "@/lib/utils";

interface HandicapGoalProps {
  currentHandicap: number;
  startingHandicap: number;
  className?: string;
}

export function HandicapGoal({
  currentHandicap,
  startingHandicap,
  className,
}: HandicapGoalProps) {
  // Calculate progress from starting handicap toward scratch (0)
  // This is a simple "journey to scratch" visualization
  const progress =
    startingHandicap > 0
      ? Math.max(
          0,
          Math.min(
            100,
            ((startingHandicap - currentHandicap) / startingHandicap) * 100
          )
        )
      : 0;

  const improvement = startingHandicap - currentHandicap;
  const isImproving = improvement > 0;

  return (
    <Card className={cn("", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          Journey to Scratch
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <Progress value={progress} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Start: {startingHandicap.toFixed(1)}</span>
            <span
              className={cn(
                "font-medium",
                isImproving
                  ? "text-green-600 dark:text-green-400"
                  : "text-foreground"
              )}
            >
              {isImproving
                ? `${improvement.toFixed(1)} improved`
                : currentHandicap.toFixed(1)}
            </span>
            <span>Scratch: 0.0</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
