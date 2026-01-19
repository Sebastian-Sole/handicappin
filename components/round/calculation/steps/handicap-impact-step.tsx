"use client";

import { Muted, P, Blockquote } from "@/components/ui/typography";
import { CalculationStep } from "../calculation-step";
import { useRoundCalculationContext } from "@/contexts/roundCalculationContext";
import { ArrowRight, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

const HandicapImpactStep = () => {
  const { scorecard, scoreDifferentialCalculation } = useRoundCalculationContext();

  const handicapBefore = Number(scorecard.round.existingHandicapIndex);
  const handicapAfter = Number(scorecard.round.updatedHandicapIndex);
  const change = handicapAfter - handicapBefore;
  const esrAdjustment = Number(scorecard.round.exceptionalScoreAdjustment);

  const getTrendIcon = () => {
    if (change < -0.05)
      return <TrendingDown className="w-6 h-6 text-green-600" />;
    if (change > 0.05)
      return <TrendingUp className="w-6 h-6 text-red-600" />;
    return <Minus className="w-6 h-6 text-muted-foreground" />;
  };

  const getChangeColor = () => {
    if (change < -0.05) return "text-green-600";
    if (change > 0.05) return "text-red-600";
    return "text-muted-foreground";
  };

  return (
    <CalculationStep
      stepNumber={4}
      title="Handicap Impact"
      description="How this round affected your Handicap Index"
      learnMoreContent={
        <div className="space-y-3">
          <Blockquote>
            Your Handicap Index is calculated from your best Score Differentials
            out of your most recent 20 rounds. The number of differentials used
            depends on how many rounds you have posted.
          </Blockquote>
          <P>
            If you&apos;ve played fewer than 20 rounds, the calculation uses a
            smaller number of your best differentials with an adjustment factor.
          </P>
          {esrAdjustment !== 0 && (
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
              <P className="text-amber-800 dark:text-amber-200 text-sm">
                <strong>Exceptional Score Reduction (ESR):</strong> When you
                post a Score Differential significantly better than your
                Handicap Index (7+ strokes), an ESR adjustment is applied to
                prevent rapid handicap manipulation.
              </P>
            </div>
          )}
          <Link
            href="https://www.usga.org/handicapping/roh/Content/rules/5%202%20Calculation%20of%20a%20Handicap%20Index.htm"
            target="_blank"
            className="text-primary hover:underline text-sm"
          >
            Read more about Handicap Index calculation (USGA)
          </Link>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Before/After comparison */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8 py-4">
          <div className="text-center">
            <Muted>Before this round</Muted>
            <div className="text-3xl font-bold">{handicapBefore.toFixed(1)}</div>
          </div>
          <ArrowRight className="w-8 h-8 text-muted-foreground hidden sm:block" />
          <div className="text-center">
            <Muted>After this round</Muted>
            <div className="text-3xl font-bold">{handicapAfter.toFixed(1)}</div>
          </div>
        </div>

        {/* Change indicator */}
        <div
          className={cn(
            "flex items-center justify-center gap-3 p-4 rounded-lg",
            change < -0.05 && "bg-green-50 dark:bg-green-950/20",
            change > 0.05 && "bg-red-50 dark:bg-red-950/20",
            Math.abs(change) <= 0.05 && "bg-muted/50"
          )}
        >
          {getTrendIcon()}
          <div>
            <P className={cn("font-semibold", getChangeColor())}>
              {change === 0
                ? "No change"
                : change > 0
                ? `+${change.toFixed(1)}`
                : change.toFixed(1)}{" "}
              {change !== 0 && "strokes"}
            </P>
            <Muted>
              {change < -0.05 && "Your handicap decreased (improved)"}
              {change > 0.05 && "Your handicap increased"}
              {Math.abs(change) <= 0.05 && "Your handicap stayed the same"}
            </Muted>
          </div>
        </div>

        {/* Exceptional Score Adjustment */}
        {esrAdjustment !== 0 && (
          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
            <P className="font-medium text-amber-800 dark:text-amber-200">
              Exceptional Score Reduction Applied
            </P>
            <Muted className="text-amber-700 dark:text-amber-300">
              This round was {Math.abs(esrAdjustment)} stroke
              {Math.abs(esrAdjustment) > 1 ? "s" : ""} better than expected. An
              ESR adjustment of {esrAdjustment} was applied to your recent
              differentials.
            </Muted>
          </div>
        )}

        {/* Score differential reminder */}
        <div className="bg-muted/50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <Muted>This round&apos;s Score Differential</Muted>
              <P className="text-2xl font-bold">
                {Math.round(scoreDifferentialCalculation * 10) / 10}
              </P>
            </div>
            <div className="text-right">
              <Muted>Differential used in calculation</Muted>
              <P className="text-2xl font-bold">
                {(
                  Math.round(scoreDifferentialCalculation * 10) / 10 +
                  esrAdjustment
                ).toFixed(1)}
              </P>
            </div>
          </div>
        </div>
      </div>
    </CalculationStep>
  );
};

export default HandicapImpactStep;
