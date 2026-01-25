import { Button } from "@/components/ui/button";
import { Tables } from "@/types/supabase";
import { ChevronRight, BarChart2, TrendingDown, Award, Target } from "lucide-react";
import Link from "next/link";
import { HandicapDisplay } from "./handicap-display";
import StatBox from "./statBox";

interface HeroProps {
  profile: Tables<"profile">;
  previousScores: number[];
  previousHandicaps: number[];
  bestRound: Tables<"round"> | null;
  bestRoundTee: Tables<"teeInfo"> | null;
  bestRoundCourseName: string | undefined;
  handicapPercentageChange: number;
}

const Hero = ({
  profile,
  previousScores,
  previousHandicaps,
  bestRound,
  bestRoundTee,
  bestRoundCourseName,
  handicapPercentageChange,
}: HeroProps) => {
  const hasPlayedAnyRounds = previousScores.length > 0;
  const firstHandicap =
    previousHandicaps.length > 0 ? previousHandicaps[0] : undefined;

  const calculatePlusMinusScore = (): string => {
    if (!bestRound || !bestRoundTee) return "—";
    const calculatedScore = bestRound.adjustedGrossScore - bestRoundTee.totalPar;
    return calculatedScore > 0 ? `+${calculatedScore}` : calculatedScore.toString();
  };

  const calculateAverageScore = (): string => {
    if (previousScores.length === 0) return "—";
    return (
      previousScores.reduce((a, b) => a + b, 0) / previousScores.length
    ).toFixed(1);
  };

  const calculateAverageScoreChange = (): number => {
    if (previousScores.length < 2) return 0;

    const halfLength = Math.floor(previousScores.length / 2);
    const firstHalfRounds = previousScores.slice(0, halfLength);
    const secondHalfRounds = previousScores.slice(halfLength);

    const firstHalfAverage =
      firstHalfRounds.reduce((a, b) => a + b, 0) / firstHalfRounds.length;
    const secondHalfAverage =
      secondHalfRounds.reduce((a, b) => a + b, 0) / secondHalfRounds.length;

    return secondHalfAverage - firstHalfAverage;
  };

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
    const avgChange = calculateAverageScoreChange();
    averageScoreChangeType = avgChange < 0 ? "improvement" : "increase";
    averageScoreChangeDescription =
      avgChange < 0
        ? Math.abs(avgChange) < 5
          ? "Your average score is slightly improving!"
          : "Your average score is improving!"
        : Math.abs(avgChange) < 5
          ? "Your average score is slightly increasing"
          : "Your average score is increasing";

    handicapChangeType =
      handicapPercentageChange < 0 ? "improvement" : "increase";
    handicapChangeDescription =
      handicapPercentageChange < 0
        ? Math.abs(handicapPercentageChange) < 0.07
          ? "Your handicap is slightly improving!"
          : "Your handicap is improving!"
        : Math.abs(handicapPercentageChange) < 0.07
          ? "Your handicap is slightly increasing"
          : "Your handicap is increasing";

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
    <section className="w-full py-6 md:py-10 lg:py-12">
      <div className="container px-4 lg:px-6">
        {/* Welcome Header */}
        <div className="mb-8">
          <h1 className="text-xl md:text-2xl font-semibold text-foreground">
            Welcome back, {profile.name?.split(" ")[0] || "Golfer"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Member since {new Date(profile.createdAt).getFullYear()}
          </p>
        </div>

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-[1fr_1.5fr] lg:gap-10">
          {/* Left: Handicap Display + CTAs */}
          <div className="flex flex-col items-center lg:items-start space-y-6">
            <HandicapDisplay
              handicapIndex={profile.handicapIndex}
              previousHandicapIndex={firstHandicap}
              className="py-6"
            />

            <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm">
              <Link href="/rounds/add" className="flex-1">
                <Button size="lg" className="w-full">
                  Log Round
                  <ChevronRight className="ml-2 h-4 w-4" />
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
          <div className="grid grid-cols-2 gap-4">
            <StatBox
              title="Handicap Index"
              value={profile.handicapIndex.toString()}
              change={handicapChangeType}
              description={handicapChangeDescription}
              icon={<BarChart2 className="h-8 w-8 text-primary" />}
            />
            <StatBox
              title="Avg. Score (Last 10)"
              value={calculateAverageScore()}
              change={averageScoreChangeType}
              description={averageScoreChangeDescription}
              icon={<TrendingDown className="h-8 w-8 text-primary" />}
            />
            <StatBox
              title="Best Round"
              value={calculatePlusMinusScore()}
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
