import { Tables } from "@/types/supabase";
import { api } from "@/trpc/server";
import Hero from "./hero";
import React from "react";
import { getRelevantRounds } from "@/lib/handicap";
import HandicapTrendChartDisplay from "../charts/handicap-trend-chart-display";
import ScoreBarChartDisplay from "../charts/score-bar-chart-display";
import Link from "next/link";
import { Button } from "../ui/button";

interface HomepageProps {
  profile: Tables<"profile">;
}

export const HomePage = async ({ profile }: HomepageProps) => {
  const { id, handicapIndex } = profile;

  const rounds = await api.round.getAllByUserId({
    userId: id,
    amount: 20,
  });

  const bestRound: Tables<"round"> | null = await api.round.getBestRound({
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

  let bestRoundCourse: Tables<"course"> | null = null;
  let bestRoundTee: Tables<"teeInfo"> | null = null;
  let relevantRoundsList: Tables<"round">[] = [];
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

    relevantRoundsList = getRelevantRounds(rounds);

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

    const course = await api.course.getCourseById({
      courseId: bestRound.courseId,
    });
    bestRoundCourse = course;

    const tee = await api.tee.getTeeById({
      teeId: bestRound.teeId,
    });
    bestRoundTee = tee;
  }

  return (
    <div className="flex flex-col min-h-screen">
      <main className="flex-1">
        <section className="w-full py-4 lg:py-4 xl:py-4 2xl:py-4 bg-gradient-to-r from-primary/5 to-primary/20">
          <Hero
            profile={profile}
            previousScores={previousScores.map((entry) => {
              return entry.score;
            })}
            bestRound={bestRound}
            bestRoundTee={bestRoundTee}
            bestRoundCourseName={bestRoundCourse?.name}
            handicapPercentageChange={percentageChange}
          />
        </section>

        <section className="w-full py-8 lg:py-18 xl:py-24">
          <div className="sm:container px-4 lg:px-6">
            <div className="text-center md:mb-12 mb-6">
              <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white mb-4 transition-colors duration-300">
                Performance Analytics
              </h2>
              <p className="text-lg text-gray-600 dark:text-gray-300 transition-colors duration-300">
                Track your progress with detailed charts and insights
              </p>
            </div>
            <div className="hidden md:grid gap-6 2xl:grid-cols-2 2xl:gap-12">
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
            <div className="grid gap-6 md:hidden">
              <div className="flex justify-center">
                <Link href={`/dashboard/${profile.id}`}>
                  <Button variant={"default"} size="lg">
                    Go to Dashboard
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* <section className="w-full py-6 lg:py-12 xl:py-16 pt-0! flex flex-col items-center">
          <span className="max-w-[800px] flex flex-col items-center space-y-8">
            <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white mb-4 transition-colors duration-300">
              Calculators
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-300 transition-colors duration-300 max-w-[80%] text-center">
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
        </section> */}
      </main>
    </div>
  );
};
