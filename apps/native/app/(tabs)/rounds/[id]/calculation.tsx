/**
 * Round calculation — native twin of apps/web/app/rounds/[id]/calculation/
 * page.tsx + components/round-calculation.tsx: overview card, stepper,
 * hole-by-hole results, and the four interactive steps (editable values
 * with modified-warning highlights and reset, formula boxes). All math
 * from @handicappin/handicap-core via lib/round-calculation.
 */
import { queryOptions, useQuery } from "@tanstack/react-query";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import {
  ArrowRight,
  CalendarDays,
  Flag,
  MapPin,
  Minus,
  RotateCcw,
  TrendingDown,
  TrendingUp,
} from "lucide-react-native";
import { ScrollView, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { tokens } from "@handicappin/tokens/tokens";

import { CalculationStep } from "@/components/round-calculation/calculation-step";
import { HolesTable } from "@/components/round-calculation/holes-table";
import { ScorecardAccordion } from "@/components/round-calculation/scorecard-accordion";
import { CalculationStepper } from "@/components/round-calculation/stepper";
import { DataSettledMarker } from "@/components/data-settled";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { H2 } from "@/components/ui/typography";
import { trpcQuery } from "@/lib/api/client";
import {
  scorecardWithRoundSchema,
  type ScorecardWithRound,
} from "@/lib/api/schemas/scorecard";
import { useSession } from "@/lib/auth/session-provider";
import { useColorMode } from "@/lib/color-mode";
import { useDataSettled } from "@/lib/query/settle";
import {
  useRoundCalculation,
  type RoundCalculation,
} from "@/lib/round-calculation";
import { cn } from "@/lib/utils";

const ICON_SIZE = 16; // allow-hardcoded lucide icon prop mirrors web's fixed h-4 w-4 icon box
const TREND_ICON_SIZE = 24; // allow-hardcoded lucide icon prop mirrors web's fixed h-6 w-6 icon box
const ARROW_ICON_SIZE = 32; // allow-hardcoded lucide icon prop mirrors web's fixed h-8 w-8 icon box

const CALCULATION_STEPS = [
  { id: 1, title: "Course Handicap" },
  { id: 2, title: "Adjusted Scores" },
  { id: 3, title: "Score Differential" },
  { id: 4, title: "Handicap Impact" },
];

const scorecardByRoundQueryOptions = (roundId: string) =>
  queryOptions({
    queryKey: ["scorecard.getScorecardByRoundId", roundId] as const,
    queryFn: () =>
      trpcQuery(
        "scorecard.getScorecardByRoundId",
        { id: roundId },
        scorecardWithRoundSchema.nullable(),
      ),
  });

export default function RoundCalculationScreen() {
  const { session, initializing } = useSession();
  const params = useLocalSearchParams<{ id?: string }>();
  const roundId = typeof params.id === "string" ? params.id : "";

  const scorecardQuery = useQuery({
    ...scorecardByRoundQueryOptions(roundId),
    enabled: session != null && roundId !== "",
  });
  const settled = useDataSettled([scorecardQuery]);

  if (initializing) return null;
  if (!session) return <Redirect href="/login" />;

  const scorecard = scorecardQuery.data;

  if (!scorecard) {
    return (
      <View
        testID="round-calculation-screen"
        className="flex-1 bg-background items-center justify-center p-lg gap-md"
      >
        <DataSettledMarker settled={settled} />
        <Text className="text-body text-muted-foreground text-center">
          {scorecardQuery.isPending
            ? "Loading round…"
            : scorecardQuery.isError
              ? `Could not load round: ${
                  scorecardQuery.error instanceof Error
                    ? scorecardQuery.error.message
                    : "unknown error"
                }`
              : "Round not found"}
        </Text>
        {!scorecardQuery.isPending ? (
          <Button variant="outline" onPress={() => router.back()}>
            Go back
          </Button>
        ) : null}
      </View>
    );
  }

  return <CalculationContent scorecard={scorecard} settled={settled} />;
}

function CalculationContent({
  scorecard,
  settled,
}: {
  scorecard: ScorecardWithRound;
  settled: boolean;
}) {
  const insets = useSafeAreaInsets();
  const calc = useRoundCalculation(scorecard);
  const roundDate = new Date(scorecard.teeTime).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const mode = useColorMode();
  const mutedColor = tokens.colors[mode]["muted-foreground"];

  return (
    <ScrollView
      testID="round-calculation-screen"
      className="flex-1 bg-background"
      contentContainerStyle={{
        paddingTop: insets.top + tokens.spacing.md,
        paddingHorizontal: tokens.spacing.md,
        paddingBottom: tokens.spacing["3xl"],
        gap: tokens.spacing.xl,
      }}
      keyboardShouldPersistTaps="handled"
    >
      <DataSettledMarker settled={settled} />

      {/* Round overview */}
      <Card>
        <CardHeader className="pb-md gap-md">
          <View>
            <H2 className="mb-sm">{scorecard.course.name}</H2>
            <View className="flex-row flex-wrap items-center gap-md">
              <View className="flex-row items-center gap-xs">
                <CalendarDays size={ICON_SIZE} color={mutedColor} />
                <Text className="text-body-sm text-muted-foreground">
                  {roundDate}
                </Text>
              </View>
              <View className="flex-row items-center gap-xs">
                <MapPin size={ICON_SIZE} color={mutedColor} />
                <Text className="text-body-sm text-muted-foreground">
                  {scorecard.teePlayed.name}
                </Text>
              </View>
              <View className="flex-row items-center gap-xs">
                <Flag size={ICON_SIZE} color={mutedColor} />
                <Text className="text-body-sm text-muted-foreground">
                  {calc.isNineHoles ? "9 Holes" : "18 Holes"}
                </Text>
              </View>
            </View>
          </View>
          <View className="flex-row items-center gap-xl">
            <View className="items-center">
              <Text className="text-figure-lg text-primary">
                {scorecard.round.adjustedGrossScore}
              </Text>
              <Text className="text-body-sm text-muted-foreground">Score</Text>
            </View>
            <View className="items-center">
              <Text className="text-figure-lg text-foreground">
                {Number(scorecard.round.scoreDifferential).toFixed(1)}
              </Text>
              <Text className="text-body-sm text-muted-foreground">
                Differential
              </Text>
            </View>
          </View>
          {calc.isNineHoles ? (
            <Badge variant="secondary" className="self-start mt-md">
              9-Hole Round - Calculated as 18-hole equivalent
            </Badge>
          ) : null}
        </CardHeader>
      </Card>

      {/* Scorecard viewer (plan 013 D2): read-only hole cards with
          Par · SI · Distance and per-hole detail where captured. */}
      <View className="gap-md">
        <H2>Scorecard</H2>
        <Text className="text-body-sm text-muted-foreground">
          Every hole you played — tap a hole to see putts, fairway, and
          penalties where you logged them.
        </Text>
        <ScorecardAccordion scorecard={scorecard} />
      </View>

      <View className="h-px bg-border" />

      <CalculationStepper steps={CALCULATION_STEPS} />

      {/* Hole-by-hole */}
      <View className="gap-md">
        <H2>Hole-by-Hole Results</H2>
        <Text className="text-body-sm text-muted-foreground">
          Your scores for each hole, with handicap strokes and adjusted
          scores.
        </Text>
        <HolesTable
          scorecard={scorecard}
          hasEstablishedHandicap={calc.hasEstablishedHandicap}
          isNineHoles={calc.isNineHoles}
          nineHoleSection={calc.nineHoleSection}
        />
      </View>

      <View className="h-px bg-border" />
      <CourseHandicapStep calc={calc} />
      <View className="h-px bg-border" />
      <AdjustedScoresStep calc={calc} />
      <View className="h-px bg-border" />
      <ScoreDifferentialStep calc={calc} />
      <View className="h-px bg-border" />
      <HandicapImpactStep calc={calc} />
    </ScrollView>
  );
}

function NumberField({
  label,
  value,
  onChange,
  modified,
  disabled,
}: {
  label: string;
  value: number;
  onChange?: (value: number) => void;
  modified?: boolean;
  disabled?: boolean;
}) {
  return (
    <View className="gap-xs flex-1" style={{ minWidth: "45%" }}>
      <Label className="text-meta">{label}</Label>
      <Input
        keyboardType="decimal-pad"
        editable={!disabled}
        value={String(value)}
        onChangeText={(text) => onChange?.(Number.parseFloat(text) || 0)}
        className={cn("h-9", modified && "border-warning tint-warning")}
      />
    </View>
  );
}

function FormulaBox({ children }: { children: React.ReactNode }) {
  return <View className="surface-muted p-md rounded-lg gap-sm">{children}</View>;
}

function CourseHandicapStep({ calc }: { calc: RoundCalculation }) {
  const mode = useColorMode();
  const { originals } = calc;
  const hasChanges =
    calc.handicapIndex !== originals.handicapIndex ||
    calc.slope !== originals.slope ||
    calc.rating !== originals.rating ||
    calc.par !== originals.par;

  return (
    <CalculationStep
      stepNumber={1}
      title="Course Handicap"
      description="How many handicap strokes you received for this round"
      learnMoreContent={
        <Text className="text-body-sm text-muted-foreground">
          Your Course Handicap represents the number of strokes you receive
          on this specific course and set of tees. The formula uses the Slope
          Rating and Course Rating per USGA Rule 6.1a.
        </Text>
      }
    >
      <View className="gap-md">
        {hasChanges ? (
          <Button
            variant="outline"
            size="sm"
            className="self-start"
            onPress={() => {
              calc.setHandicapIndex(originals.handicapIndex);
              calc.setSlope(originals.slope);
              calc.setRating(originals.rating);
              calc.setPar(originals.par);
            }}
          >
            <View className="flex-row items-center gap-sm">
              <RotateCcw
                size={ICON_SIZE}
                color={tokens.colors[mode].foreground}
              />
              <Text className="text-label-sm text-foreground">
                Reset to original values
              </Text>
            </View>
          </Button>
        ) : null}

        <View className="flex-row flex-wrap gap-md">
          <NumberField
            label="Handicap Index"
            value={calc.handicapIndex}
            onChange={calc.setHandicapIndex}
            modified={calc.handicapIndex !== originals.handicapIndex}
          />
          <NumberField
            label="Slope Rating"
            value={calc.slope}
            onChange={calc.setSlope}
            modified={calc.slope !== originals.slope}
          />
          <NumberField
            label="Course Rating"
            value={calc.rating}
            onChange={calc.setRating}
            modified={calc.rating !== originals.rating}
          />
          <NumberField
            label="Par"
            value={calc.par}
            onChange={calc.setPar}
            modified={calc.par !== originals.par}
          />
        </View>

        <View className="flex-row items-center gap-sm">
          <Label className="text-meta">18 holes</Label>
          <Switch
            value={calc.isNineHoles}
            onValueChange={(checked) => {
              calc.setIsNineHoles(checked);
              calc.setHolesPlayed(checked ? 9 : 18);
            }}
            trackColor={{
              false: tokens.colors[mode].muted,
              true: tokens.colors[mode].primary,
            }}
            thumbColor={tokens.colors[mode].background}
          />
          <Label className="text-meta">9 holes</Label>
        </View>

        <FormulaBox>
          <Text className="text-body-sm text-muted-foreground">
            {calc.isNineHoles
              ? "Course Handicap (9 holes) = (Handicap Index ÷ 2) × (Slope ÷ 113) + (Course Rating − Par)"
              : "Course Handicap (18 holes) = Handicap Index × (Slope ÷ 113) + (Course Rating − Par)"}
          </Text>
          <View className="flex-row flex-wrap items-center gap-sm">
            <Text className="text-body-sm font-medium text-foreground">
              Course Handicap =
            </Text>
            <Text className="text-body-sm text-muted-foreground">
              {calc.isNineHoles
                ? `(${calc.handicapIndex} ÷ 2)`
                : calc.handicapIndex}{" "}
              × ({calc.slope} ÷ 113) + ({calc.rating} − {calc.par})
            </Text>
            <Text className="text-body-sm font-medium text-foreground">=</Text>
            <Text className="text-figure-sm text-primary">
              {Math.round(calc.courseHandicapCalculation)}
            </Text>
            <Text className="text-body-sm text-muted-foreground">strokes</Text>
          </View>
        </FormulaBox>
      </View>
    </CalculationStep>
  );
}

function AdjustedScoresStep({ calc }: { calc: RoundCalculation }) {
  const totalStrokes = calc.scorecard.scores.reduce(
    (acc, score) => acc + score.strokes,
    0,
  );
  const adjustmentAmount = totalStrokes - calc.apsStat;

  return (
    <CalculationStep
      stepNumber={2}
      title="Adjusted Scores"
      description="How your hole scores were capped for handicap purposes"
      learnMoreContent={
        <Text className="text-body-sm text-muted-foreground">
          The USGA limits the maximum score on any hole (Net Double Bogey) so
          one bad hole can&apos;t disproportionately affect your handicap.
          Players with fewer than 3 approved rounds use a simpler Par + 5
          maximum.
        </Text>
      }
    >
      <View className="gap-md">
        <View className="flex-row flex-wrap gap-md">
          <View className="surface-muted p-md rounded-lg flex-1" style={{ minWidth: "45%" }}>
            <Text className="text-figure text-foreground">{totalStrokes}</Text>
            <Text className="text-meta text-muted-foreground">
              Total Strokes
            </Text>
          </View>
          <View className="surface-muted p-md rounded-lg flex-1" style={{ minWidth: "45%" }}>
            <Text className="text-figure text-foreground">{calc.apsStat}</Text>
            <Text className="text-meta text-muted-foreground">
              Adjusted Score
            </Text>
          </View>
          <View className="surface-muted p-md rounded-lg flex-1" style={{ minWidth: "45%" }}>
            <Text className="text-figure text-success">
              {adjustmentAmount > 0 ? `-${adjustmentAmount}` : adjustmentAmount}
            </Text>
            <Text className="text-meta text-muted-foreground">
              Strokes Saved
            </Text>
          </View>
        </View>

        {adjustmentAmount > 0 ? (
          <View className="tint-warning p-md rounded-lg">
            <Text className="text-body-sm text-warning">
              Some hole scores were capped, saving you {adjustmentAmount}{" "}
              stroke{adjustmentAmount > 1 ? "s" : ""} in your handicap
              calculation.
            </Text>
          </View>
        ) : (
          <View className="tint-success p-md rounded-lg">
            <Text className="text-body-sm text-success">
              No holes were capped - all your scores were within the Net
              Double Bogey limit.
            </Text>
          </View>
        )}

        <FormulaBox>
          <Text className="text-body-sm text-muted-foreground">
            Adjusted Played Score = Sum of all adjusted hole scores
          </Text>
          <View className="flex-row items-center gap-sm">
            <Text className="text-body-sm font-medium text-foreground">
              Adjusted Played Score =
            </Text>
            <Text className="text-figure-sm text-primary">{calc.apsStat}</Text>
          </View>
        </FormulaBox>
      </View>
    </CalculationStep>
  );
}

function ScoreDifferentialStep({ calc }: { calc: RoundCalculation }) {
  return (
    <CalculationStep
      stepNumber={3}
      title="Score Differential"
      description="Your performance relative to course difficulty"
      learnMoreContent={
        <Text className="text-body-sm text-muted-foreground">
          The Score Differential measures how well you played compared to the
          difficulty of the course (USGA Rule 5.1). Lower is better; your
          Handicap Index is calculated from your best differentials.
        </Text>
      }
    >
      <View className="gap-md">
        <View className="flex-row flex-wrap gap-md">
          <NumberField
            label={
              calc.isNineHoles
                ? "Adjusted Played Score (9)"
                : "Adjusted Gross Score"
            }
            value={
              calc.isNineHoles
                ? calc.adjustedPlayedScore
                : calc.adjustedGrossScoreCalculation
            }
            disabled
          />
          <NumberField
            label="Course Rating"
            value={calc.rating}
            onChange={calc.setRating}
            modified={calc.rating !== calc.originals.rating}
          />
          <NumberField
            label="Slope Rating"
            value={calc.slope}
            onChange={(value) => {
              if (value > 0) calc.setSlope(value);
            }}
            modified={calc.slope !== calc.originals.slope}
          />
        </View>

        {calc.isNineHoles ? (
          <FormulaBox>
            <Text className="text-body-sm text-muted-foreground">
              9-Hole Score Differential = Played Differential + Expected
              Differential
            </Text>
            <Text className="text-body-sm text-muted-foreground">
              ({calc.adjustedPlayedScore} − {calc.rating}) × 113 ÷ {calc.slope}{" "}
              = {calc.playedDifferential.toFixed(2)}
            </Text>
            <Text className="text-body-sm text-muted-foreground">
              Expected (unplayed 9) = {calc.expectedDifferential.toFixed(2)}
            </Text>
            <View className="flex-row flex-wrap items-center gap-sm border-t border-border pt-sm">
              <Text className="text-body-sm font-medium text-foreground">
                18-Hole Equivalent =
              </Text>
              <Text className="text-body-sm text-muted-foreground">
                {calc.playedDifferential.toFixed(2)} +{" "}
                {calc.expectedDifferential.toFixed(2)}
              </Text>
              <Text className="text-body-sm font-medium text-foreground">
                =
              </Text>
              <Text className="text-figure-sm text-primary">
                {calc.scoreDifferentialCalculation.toFixed(1)}
              </Text>
            </View>
          </FormulaBox>
        ) : (
          <FormulaBox>
            <Text className="text-body-sm text-muted-foreground">
              Score Differential = (Adjusted Gross Score − Course Rating) ×
              113 ÷ Slope Rating
            </Text>
            <View className="flex-row flex-wrap items-center gap-sm">
              <Text className="text-body-sm font-medium text-foreground">
                Score Differential =
              </Text>
              <Text className="text-body-sm text-muted-foreground">
                ({calc.adjustedGrossScoreCalculation} − {calc.rating}) × 113 ÷{" "}
                {calc.slope}
              </Text>
              <Text className="text-body-sm font-medium text-foreground">
                =
              </Text>
              <Text className="text-figure-sm text-primary">
                {calc.scoreDifferentialCalculation.toFixed(1)}
              </Text>
            </View>
          </FormulaBox>
        )}
      </View>
    </CalculationStep>
  );
}

function HandicapImpactStep({ calc }: { calc: RoundCalculation }) {
  const mode = useColorMode();
  const handicapBefore = Number(calc.scorecard.round.existingHandicapIndex);
  const handicapAfter = Number(calc.scorecard.round.updatedHandicapIndex);
  const change = handicapAfter - handicapBefore;
  const esrAdjustment = Number(
    calc.scorecard.round.exceptionalScoreAdjustment,
  );

  const TrendIcon =
    change < -0.05 ? TrendingDown : change > 0.05 ? TrendingUp : Minus;
  const trendColor =
    change < -0.05
      ? tokens.colors[mode].success
      : change > 0.05
        ? tokens.colors[mode].destructive
        : tokens.colors[mode]["muted-foreground"];
  const changeTextClass =
    change < -0.05
      ? "text-success"
      : change > 0.05
        ? "text-destructive"
        : "text-muted-foreground";

  return (
    <CalculationStep
      stepNumber={4}
      title="Handicap Impact"
      description="How this round affected your Handicap Index"
      learnMoreContent={
        <View className="gap-sm">
          <Text className="text-body-sm text-muted-foreground">
            Your Handicap Index is recalculated from your best Score
            Differentials (USGA Rule 5.2). Exceptional rounds (7+ strokes
            better than your index) trigger an additional ESR adjustment.
          </Text>
          <Text className="text-body-sm text-muted-foreground">
            Your Handicap Index can also be limited by the WHS soft and hard
            caps: once it would rise more than 3.0 strokes above your lowest
            index of the last 365 days, further increases are halved, and it
            can never rise more than 5.0 above that low point. If a cap
            applied to this round, the &apos;after&apos; value reflects it.
          </Text>
          <Text className="text-body-sm text-muted-foreground">
            Official handicap bodies also apply a daily Playing Conditions
            Calculation (PCC) of &minus;1.0 to +3.0. Handicappin&apos; does
            not apply PCC, so your index here can differ slightly from an
            official one.
          </Text>
        </View>
      }
    >
      <View className="gap-md">
        <View className="flex-row items-center justify-center gap-xl py-md">
          <View className="items-center">
            <Text className="text-body-sm text-muted-foreground">
              Before this round
            </Text>
            <Text className="text-figure-lg text-foreground">
              {handicapBefore.toFixed(1)}
            </Text>
          </View>
          <ArrowRight
            size={ARROW_ICON_SIZE}
            color={tokens.colors[mode]["muted-foreground"]}
          />
          <View className="items-center">
            <Text className="text-body-sm text-muted-foreground">
              After this round
            </Text>
            <Text className="text-figure-lg text-foreground">
              {handicapAfter.toFixed(1)}
            </Text>
          </View>
        </View>

        <View
          className={cn(
            "flex-row items-center justify-center gap-sm p-md rounded-lg",
            change < -0.05 && "tint-success",
            change > 0.05 && "tint-destructive",
            Math.abs(change) <= 0.05 && "bg-muted",
          )}
        >
          <TrendIcon size={TREND_ICON_SIZE} color={trendColor} />
          <View className="shrink">
            <Text className={cn("text-body font-semibold", changeTextClass)}>
              {Math.abs(change) <= 0.05
                ? "No change"
                : change > 0
                  ? `+${change.toFixed(1)} strokes`
                  : `${change.toFixed(1)} strokes`}
            </Text>
            <Text className="text-body-sm text-muted-foreground">
              {change < -0.05 && "Your handicap decreased (improved)"}
              {change > 0.05 && "Your handicap increased"}
              {Math.abs(change) <= 0.05 && "Your handicap stayed the same"}
            </Text>
          </View>
        </View>

        {esrAdjustment !== 0 ? (
          <View className="tint-warning p-md rounded-lg">
            <Text className="text-body font-medium text-warning">
              Exceptional Score Reduction Applied
            </Text>
            <Text className="text-body-sm text-warning">
              This round was {Math.abs(esrAdjustment)} stroke
              {Math.abs(esrAdjustment) > 1 ? "s" : ""} better than expected.
              An ESR adjustment of {esrAdjustment} was applied to your recent
              differentials.
            </Text>
          </View>
        ) : null}

        <FormulaBox>
          {/* Columns get flex-1 so the long labels WRAP — Yoga gives text
              flexShrink:0 by default, which is what overflowed the screen. */}
          <View className="flex-row items-center justify-between gap-md">
            <View className="flex-1">
              <Text className="text-body-sm text-muted-foreground">
                This round&apos;s Score Differential
              </Text>
              <Text className="text-figure text-foreground">
                {Math.round(calc.scoreDifferentialCalculation * 10) / 10}
              </Text>
            </View>
            <View className="flex-1 items-end">
              <Text className="text-body-sm text-muted-foreground text-right">
                Differential used in calculation
              </Text>
              <Text className="text-figure text-foreground">
                {(
                  Math.round(calc.scoreDifferentialCalculation * 10) / 10 +
                  esrAdjustment
                ).toFixed(1)}
              </Text>
            </View>
          </View>
        </FormulaBox>
      </View>
    </CalculationStep>
  );
}
