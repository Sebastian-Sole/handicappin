import { Button } from "@/components/ui/button";
import { H1 } from "@/components/ui/typography";
import { Tables } from "@/types/supabase";
import { ChevronRight, BarChart2, TrendingDown, Award, Target } from "lucide-react";
import Link from "next/link";
import { HandicapDisplay } from "./handicap-display";
import StatBox from "./statBox";
import {
  calculatePlusMinusScore,
  calculateAverageScore,
  calculateAverageScoreChange,
  getChangeType,
  getAverageScoreChangeDescription,
  getHandicapChangeDescription,
} from "@/utils/golf-stats";

interface HeroProps {
  profile: Tables<"profile">;
  previousScores: number[];
  initialHandicapIndex: number | null;
  bestRound: Tables<"round"> | null;
  bestRoundTee: Tables<"teeInfo"> | null;
  bestRoundCourseName: string | undefined;
  handicapPercentageChange: number;
}

const Hero = ({
  profile,
  previousScores,
  initialHandicapIndex,
  bestRound,
  bestRoundTee,
  bestRoundCourseName,
  handicapPercentageChange,
}: HeroProps) => {
  const hasPlayedAnyRounds = previousScores.length > 0;

  // Determine change types and descriptions
  let averageScoreChangeType: string;
  let averageScoreChangeDescription: string;
  let handicapChangeType: string;
  let handicapChangeDescription: string;
  let bestRoundDescription: string;
  let roundsPlayedDescription: string;
  let bestRoundType: string;
  let roundsPlayedType: string;

  if (!hasPlayedAnyRounds) {
    averageScoreChangeType = "neutral";
    averageScoreChangeDescription = "Log a round to start your progression";
    handicapChangeType = "neutral";
    handicapChangeDescription = "Log a round to start your progression";
    bestRoundType = "neutral";
    bestRoundDescription = "Log a round to start your progression";
    roundsPlayedType = "neutral";
    roundsPlayedDescription = "Log a round to start your progression";
  } else {
    const avgChange = calculateAverageScoreChange(previousScores);
    averageScoreChangeType = getChangeType(avgChange);
    averageScoreChangeDescription = getAverageScoreChangeDescription(avgChange);

    handicapChangeType = getChangeType(handicapPercentageChange);
    handicapChangeDescription = getHandicapChangeDescription(handicapPercentageChange);

    bestRoundDescription = bestRoundCourseName
      ? `Best round at ${bestRoundCourseName}`
      : "Best round";
    roundsPlayedDescription =
      previousScores.length < 20
        ? "Psst! 20 rounds gives you a complete handicap index!"
        : "You've played a lot of rounds!";
    bestRoundType = "achievement";
    roundsPlayedType = "achievement";
  }

  return (
    <section className="w-full py-lg md:py-2xl lg:py-2xl">
      <div className="sm:container px-md lg:px-lg">
        {/* Welcome Header */}
        <div className="mb-xl">
          <H1 className="text-xl md:text-2xl font-semibold text-foreground">
            Welcome back, {profile.name?.split(" ")[0] || "Golfer"}
          </H1>
          <p className="text-sm text-muted-foreground mt-xs">
            Member since {new Date(profile.createdAt).getFullYear()}
          </p>
        </div>

        {/* Main Content Grid */}
        <div className="grid gap-lg lg:grid-cols-[1fr_1.5fr] lg:gap-2xl">
          {/* Left: Handicap Display + CTAs */}
          <div className="flex flex-col items-center lg:items-start space-y-lg">
            <HandicapDisplay
              handicapIndex={profile.handicapIndex}
              previousHandicapIndex={initialHandicapIndex ?? undefined}
              className="py-lg"
            />

            <div className="flex flex-col sm:flex-row gap-sm w-full max-w-sm">
              <Link href="/rounds/add" className="flex-1">
                <Button size="lg" className="w-full">
                  Log Round
                  <ChevronRight className="ml-sm h-4 w-4" />
                </Button>
              </Link>
              <Link href={`/dashboard/${profile.id}`} className="flex-1">
                <Button size="lg" variant="outline" className="w-full">
                  Dashboard
                </Button>
              </Link>
            </div>
          </div>

          {/* Right: Stat Cards Grid (using original StatBox) */}
          <div className="grid grid-cols-2 gap-md">
            <StatBox
              title="Handicap Index"
              value={profile.handicapIndex.toString()}
              change={handicapChangeType}
              description={handicapChangeDescription}
              icon={<BarChart2 className="h-8 w-8 text-primary" />}
            />
            <StatBox
              title="Avg. Score (Last 10)"
              value={calculateAverageScore(previousScores)}
              change={averageScoreChangeType}
              description={averageScoreChangeDescription}
              icon={<TrendingDown className="h-8 w-8 text-primary" />}
            />
            <StatBox
              title="Best Round"
              value={calculatePlusMinusScore(bestRound?.adjustedGrossScore, bestRoundTee?.totalPar)}
              change={bestRoundType}
              description={bestRoundDescription}
              icon={<Award className="h-8 w-8 text-primary" />}
            />
            <StatBox
              title="Rounds Played"
              value={previousScores.length.toString()}
              change={roundsPlayedType}
              description={roundsPlayedDescription}
              icon={<Target className="h-8 w-8 text-primary" />}
            />
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
