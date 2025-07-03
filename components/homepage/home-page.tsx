import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Tables } from "@/types/supabase";
import { api } from "@/trpc/server";
import Hero from "./hero";
import React from "react";
import { RoundWithCourse } from "@/types/database";
import { getRelevantRounds } from "@/utils/calculations/handicap";
import CourseHandicapCalculator from "../calculators/course-handicap";
import ScoreDifferentialCalculator from "../calculators/score-differential";
import HandicapTrendChartDisplay from "../charts/handicap-trend-chart-display";
import ScoreBarChartDisplay from "../charts/score-bar-chat-display";

interface HomepageProps {
  profile: Tables<"profile">;
}

export const HomePage = async ({ profile }: HomepageProps) => {
  const { id, handicapIndex } = profile;

  const rounds = await api.round.getAllByUserId({
    userId: id,
    amount: 20,
  });

  const bestRound: RoundWithCourse | null = await api.round.getBestRound({
    userId: id,
  });

  let previousHandicaps: {
    roundDate: string;
    handicap: number;
  }[] = [];
  let previousScores: {
    roundDate: string;
    score: number;
  }[] = [];
  let percentageChange = 0;

  if (bestRound !== null) {
    previousHandicaps = rounds
      .sort((a, b) => {
        return new Date(a.teeTime).getTime() - new Date(b.teeTime).getTime();
      })
      .slice(-10)
      .map((round) => ({
        roundDate: new Date(round.teeTime).toLocaleDateString(),
        handicap: round.updatedHandicapIndex,
      }));

    const relevantRoundsList = getRelevantRounds(rounds);

    previousScores = rounds
      .sort((a, b) => {
        return new Date(a.teeTime).getTime() - new Date(b.teeTime).getTime();
      })
      .slice(-10)
      .map((round) => ({
        roundDate: new Date(round.teeTime).toLocaleDateString(),
        score: round.adjustedGrossScore,
        influencesHcp: relevantRoundsList.includes(round),
      }));

    percentageChange = Number.parseFloat(
      (
        (handicapIndex - previousHandicaps[0].handicap) /
        previousHandicaps[0].handicap
      ).toFixed(2)
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <main className="flex-1">
        <section className="w-full py-4 lg:py-4 xl:py-4 2xl:py-4 bg-primary-alternate dark:bg-primary/80">
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
              />
            </div>
          </div>
        </section>

        <section className="w-full py-6 lg:py-12 xl:py-16 !pt-0 flex flex-col items-center">
          <span className="max-w-[800px] flex flex-col items-center space-y-8">
            <h2 className="text-3xl font-bold tracking-tighter md:text-4xl lg:text-5xl mt-4 text-primary">
              Calculators
            </h2>
            <p className="text-center	max-w-[80%]">
              We know that golf statistics and round calculations are
              confusing... that&apos;s why we made Handicappin&apos;. Other golf
              services hide the inner workings of the calculations that go into
              your handicap index and scores, but we believe in transparency.
              View all calculators below, and find detailed calculations of your
              rounds in your dashboard.
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
