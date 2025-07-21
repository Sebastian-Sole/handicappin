import { Button } from "@/components/ui/button";
import { Tables } from "@/types/supabase";
import { ChevronRight, BarChart2, TrendingDown, Award } from "lucide-react";
import Link from "next/link";
import StatBox from "@/components/homepage/statBox";

interface HeroProps {
  profile: Tables<"profile">;
  previousScores: number[];
  bestRound: Tables<"round"> | null;
  bestRoundTee: Tables<"teeInfo"> | null;
  bestRoundCourseName: string | undefined;
  handicapPercentageChange: number;
}

const Hero = ({
  profile,
  previousScores,
  bestRound,
  bestRoundTee,
  bestRoundCourseName,
  handicapPercentageChange,
}: HeroProps) => {
  let hasPlayedAnyRounds = false;
  if (previousScores.length > 0) {
    hasPlayedAnyRounds = true;
  }

  const calculatePlusMinusScore = (): string => {
    if (
      bestRound === undefined ||
      bestRound === null ||
      bestRoundTee === undefined ||
      bestRoundTee === null
    ) {
      return "N/A";
    }
    const calculatedScore =
      bestRound.adjustedGrossScore - bestRoundTee.totalPar;
    if (calculatedScore > 0) {
      return `+${calculatedScore}`;
    }
    return calculatedScore.toString();
  };

  const profileYear = new Date(profile.createdAt).getFullYear();

  const calculateAverageScore = (): string => {
    if (previousScores.length === 0) {
      return "N/A";
    }
    return (
      previousScores.reduce((a, b) => a + b, 0) / previousScores.length
    ).toFixed(1);
  };

  const calculateAverageScoreChange = (): number => {
    if (previousScores.length < 0) {
      return 0;
    }

    // Split the rounds in half
    const halfLength = Math.floor(previousScores.length / 2);
    const firstHalfRounds = previousScores.slice(0, halfLength);
    const secondHalfRounds = previousScores.slice(halfLength);

    const firstHalfAverage =
      firstHalfRounds.reduce((a, b) => a + b, 0) / firstHalfRounds.length;

    const secondHalfAverage =
      secondHalfRounds.reduce((a, b) => a + b, 0) / secondHalfRounds.length;

    // Calculate the difference
    const difference = secondHalfAverage - firstHalfAverage;

    // Format the result with + or - sign
    if (difference > 0) {
      return difference;
    } else if (difference < 0) {
      return difference;
    } else {
      return 0;
    }
  };

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
    averageScoreChangeType =
      calculateAverageScoreChange() < 0 ? "improvement" : "increase";
    averageScoreChangeDescription =
      calculateAverageScoreChange() < 0
        ? Math.abs(calculateAverageScoreChange()) < 5
          ? "Your average score is slightly improving!"
          : "Your average score is improving!"
        : Math.abs(calculateAverageScoreChange()) < 5
        ? "Your average score is slightly increasing"
        : "Your average score is increasing";

    handicapChangeType =
      handicapPercentageChange < 0 ? "improvement" : "increase";
    handicapChangeDescription =
      handicapPercentageChange < 0
        ? Math.abs(handicapPercentageChange) < 7
          ? "Your handicap is slightly improving!"
          : "Your handicap is improving!"
        : Math.abs(handicapPercentageChange) < 7
        ? "Your handicap is slightly increasing"
        : "Your handicap is increasing";
    bestRoundDescription = bestRoundCourseName
      ? `Best round at ${bestRoundCourseName}`
      : `Best round`;
    roundsPlayedDescription =
      previousScores.length < 20
        ? "Psst! 20 rounds gives you a complete handicap index!"
        : "You've played a lot of rounds!";
    bestRoundType = "achievement";
    roundsPlayedType = "achievement";
  }

  return (
    <section className="w-full py-4 lg:py-8 xl:py-12 2xl:py-24 bg-cover bg-center">
      <div className="sm:container px-4 lg:px-6">
        <div className="grid gap-6 xl:grid-cols-[1fr_460px] xl:gap-12 2xl:grid-cols-[1fr_600px]">
          <div className="flex flex-col justify-between space-y-4 backdrop-blur-xs rounded-xl shadow-lg h-full">
            <div className="space-y-4">
              <div className="space-y-4">
                <h1 className="text-2xl font-semibold text-gray-900 dark:text-white transition-colors duration-300">
                  Welcome back, {profile.name!.split(" ")[0]}!
                </h1>
                <p className="text-gray-600 dark:text-gray-300 transition-colors duration-300">
                  Member since {profileYear} • Handicap {profile.handicapIndex}
                </p>

                <div className="space-y-3">
                  <h2 className="text-3xl lg:text-5xl font-bold text-gray-900 dark:text-white leading-tight transition-colors duration-300">
                    Your Golf Journey
                    <span className="text-primary block transition-colors duration-300">
                      Continues
                    </span>
                  </h2>
                  <p className="text-lg text-gray-600 dark:text-gray-300 leading-relaxed transition-colors duration-300 max-w-[500px]">
                    Log a new round, view your stats, or check out our
                    calculators to improve your game!
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-2 min-[460px]:flex-row">
                <Link href={"/rounds/add"}>
                  <Button size="lg" className="w-full">
                    Log New Round
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Link href={`/dashboard/${profile.id}`}>
                  <Button
                    size="lg"
                    variant="outline"
                    className="border-primary text-primary hover:bg-primary/10 hover:text-muted-foreground w-full"
                  >
                    View Full Stats
                  </Button>
                </Link>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white transition-colors duration-300">
                Your Performance
              </h3>
            </div>
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
                icon={<BarChart2 className="h-8 w-8 text-primary" />}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
