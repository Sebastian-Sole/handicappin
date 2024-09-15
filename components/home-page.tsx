import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Tables } from "@/types/supabase";
import { api } from "@/trpc/server";
import Hero from "./hero";
import React from "react";
import CourseHandicapCalculator from "./calculators/course-handicap";
import ScoreDifferentialCalculator from "./calculators/score-differential";
import { RoundWithCourse } from "@/types/database";
import HandicapTrendChartDisplay from "./charts/handicap-trend-chart-display";
import ScoreBarChartDisplay from "./charts/score-bar-chat-display";

interface HomepageProps {
  profile: Tables<"Profile">;
}

export const HomePage = async ({ profile }: HomepageProps) => {
  const { id, handicapIndex } = profile;

  const rounds = await api.round.getAllByUserId({
    userId: id,
    amount: 10,
  });

  const bestRound: RoundWithCourse = await api.round.getBestRound({
    userId: id,
  });

  const previousHandicaps = rounds
    .map((round) => ({
      roundDate: new Date(round.teeTime).toLocaleDateString(),
      handicap: round.updatedHandicapIndex,
    }))
    .sort((a, b) => {
      return new Date(a.roundDate).getTime() - new Date(b.roundDate).getTime();
    });

  const previousScores = rounds
    .map((round) => ({
      roundDate: new Date(round.teeTime).toLocaleDateString(),
      score: round.adjustedGrossScore,
    }))
    .sort((a, b) => {
      return new Date(a.roundDate).getTime() - new Date(b.roundDate).getTime();
    });

  const percentageChange = Number.parseFloat(
    (
      (handicapIndex - previousHandicaps[0].handicap) /
      previousHandicaps[0].handicap
    ).toFixed(2)
  );

  return (
    <div className="flex flex-col min-h-screen">
      <main className="flex-1">
        <section className="w-full py-4 lg:py-4 xl:py-4 2xl:py-4 bg-primary">
          <Hero
            profile={profile}
            previousScores={previousScores.map((entry) => {
              return entry.score;
            })}
            bestRound={bestRound}
          />
        </section>

        <section className="w-full py-12 lg:py-24 xl:py-32">
          <div className="sm:container px-4 lg:px-6">
            <div className="grid gap-6 xl:grid-cols-2 xl:gap-12">
              <HandicapTrendChartDisplay
                handicapIndex={handicapIndex}
                percentageChange={percentageChange}
                previousHandicaps={previousHandicaps}
                profile={profile}
              />
              <ScoreBarChartDisplay
                previousScores={previousScores}
                profile={profile}
              ></ScoreBarChartDisplay>
            </div>
          </div>
        </section>

        <section className="w-full py-12 lg:py-24 xl:py-32 bg-muted">
          <div className="container px-4 lg:px-6">
            <div className="grid gap-10 mx-auto max-w-[800px]">
              <div className="space-y-4">
                <h2 className="text-3xl font-bold tracking-tighter md:text-4xl lg:text-5xl">
                  Making Golf Accessible
                </h2>
                <p className="text-muted-foreground">
                  We found that other golf services overcomplicated golfing,
                  whether it be keeping scores, or hiding the calculations
                  behind *cough* ugly *cough* UI&apos;s. We put user experience
                  first, and aim to make keeping track of your golf game
                  effortless, all while helping golfers understand the
                  calculations behind the scenes.
                </p>
              </div>
              <div className="space-y-4">
                <h3 className="text-2xl font-bold tracking-tighter">
                  Key Features
                </h3>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                  <li>Round-tracking</li>
                  <li>
                    Real-time, <b>accurate</b> handicap index updates according
                    to <b>2024 USGA rules</b>
                  </li>
                  <li>
                    Interactive statistic <b>calculators</b>
                  </li>
                  <li>
                    Detailed <b>explanations</b> of how your played rounds
                    affected your handicap
                  </li>
                  <li>
                    Frivolities - Find virtually any statistic you could want{" "}
                    <b>(Coming Soon)</b>
                  </li>
                  <li>
                    Guaranteed the <b>easiest</b> golf application to use on the
                    market
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section className="w-full py-6 lg:py-12 xl:py-16 flex flex-col items-center">
          <span className="max-w-[800px] flex flex-col items-center space-y-8">
            <h2 className="text-3xl font-bold tracking-tighter md:text-4xl lg:text-5xl mt-4">
              Calculators
            </h2>
            <p className="text-muted-foreground text-center	max-w-[80%]">
              We found that other golf services overcomplicated golfing, whether
              it be keeping scores, or hiding the calculations behind *cough*
              ugly *cough* UI&apos;s. We put user experience first, and aim to
              make keeping track of your golf game effortless, all while helping
              golfers understand the calculations behind the scenes.
            </p>
            <Link href={"/calculators"}>
              <Button variant={"link"}>View all calculators</Button>
            </Link>
          </span>

          <span className="flex flex-row justify-between pt-16 w-full">
            <div className="container px-4 lg:px-6">
              <div className="grid gap-6 xl:grid-cols-2 xl:gap-12">
                <CourseHandicapCalculator handicapIndex={handicapIndex} />
                <ScoreDifferentialCalculator />
              </div>
            </div>
          </span>
        </section>
      </main>
    </div>
  );
};
