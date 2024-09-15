import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Flag, ArrowUp, ArrowDown } from "lucide-react";
import Link from "next/link";
import { Tables } from "@/types/supabase";
import { api } from "@/trpc/server";
import HandicapTrendChart from "./charts/handicap-trend-chart";
import ScoreBarChart from "./charts/score-bar-chart";
import Hero from "./hero";
import React from "react";
import CourseHandicapCalculator from "./calculators/course-handicap";
import ScoreDifferentialCalculator from "./calculators/score-differential";
import { H2, Large } from "./ui/typography";

interface HomepageProps {
  profile: Tables<"Profile">;
}

export const HomePage = async ({ profile }: HomepageProps) => {
  const { id, email, name, handicapIndex } = profile;

  const rounds = await api.round.getAllByUserId({
    userId: id,
    amount: 10,
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
          />
        </section>

        <section className="w-full py-12 lg:py-24 xl:py-32">
          <div className="sm:container px-4 lg:px-6">
            <div className="grid gap-6 xl:grid-cols-2 xl:gap-12">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <React.Fragment>
                    <CardTitle className="sm:text-2xl text-xl min-[400px]:hidden">
                      HCP Trend
                    </CardTitle>
                    <CardTitle className="sm:text-2xl text-xl min-[400px]:block hidden">
                      Handicap Trend
                    </CardTitle>
                  </React.Fragment>
                  <div className="flex items-center space-x-2">
                    <span className="sm:text-2xl text-xl font-bold">
                      {handicapIndex}
                    </span>
                    <div className="min-[340px]:block hidden">
                      {percentageChange < 0 && (
                        <span className="flex items-center text-sm text-green-500">
                          <ArrowDown className="h-4 w-4 mr-1" />
                          {percentageChange}%
                        </span>
                      )}
                      {percentageChange >= 0 && (
                        <span className="flex items-center text-sm text-red-500">
                          <ArrowUp className="h-4 w-4 mr-1" />+
                          {percentageChange}%
                        </span>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0 lg:min-h-[300px]">
                  <div className="w-full h-full pt-8 pr-8">
                    <HandicapTrendChart
                      previousHandicaps={previousHandicaps}
                      isPositive={percentageChange > 0}
                    />
                  </div>
                </CardContent>
                <CardFooter className="pt-4">
                  {/* TODO: Change to button variant link */}
                  <Link
                    href="/handicap-details"
                    className="text-sm text-center w-full text-primary hover:underline"
                  >
                    View more
                  </Link>
                </CardFooter>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="sm:text-2xl text-xl">
                    Previous Scores
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0 lg:min-h-[300px]">
                  <div className="w-full h-full pt-8 pr-8">
                    <ScoreBarChart scores={previousScores} />
                  </div>
                </CardContent>
                <CardFooter className="pt-4">
                  <Link
                    href="/score-details"
                    className="text-sm text-center w-full text-primary hover:underline"
                  >
                    View more
                  </Link>
                </CardFooter>
              </Card>
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
              {/* <div className="space-y-4">
                <p className="text-muted-foreground">
                  Ready to take your game to the next level? Explore our{" "}
                  <Link
                    href="/features"
                    className="text-primary hover:underline"
                  >
                    full feature set
                  </Link>{" "}
                  or{" "}
                  <Link
                    href="/pricing"
                    className="text-primary hover:underline"
                  >
                    check out our pricing plans
                  </Link>
                  .
                </p>
              </div> */}
            </div>
          </div>
        </section>

        <section className="w-full py-6 lg:py-12 xl:py-16 flex flex-col items-center">
          <span className="max-w-[800px] flex flex-col items-center space-y-8">
            <h2 className="text-3xl font-bold tracking-tighter md:text-4xl lg:text-5xl">
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

      <footer className="w-full border-t py-6">
        <div className="container px-4 lg:px-6">
          <div className="flex flex-col items-center justify-between gap-4 lg:flex-row">
            <div className="text-center lg:text-left flex flex-row">
              <p className="text-sm text-muted-foreground">
                © 2024 Handicappin&apos;. All rights reserved. Developed By:{" "}
                <a href="https://www.soleinnovations.com">SoleInnovations</a>
              </p>
            </div>
            <nav className="flex gap-4 md:gap-6">
              <Link
                className="text-sm font-medium hover:underline underline-offset-4"
                href="/"
              >
                Home
              </Link>
              <Link
                className="text-sm font-medium hover:underline underline-offset-4"
                href="/features"
              >
                Features
              </Link>
              <Link
                className="text-sm font-medium hover:underline underline-offset-4"
                href="/pricing"
              >
                Pricing
              </Link>
              <Link
                className="text-sm font-medium hover:underline underline-offset-4"
                href="/about"
              >
                About
              </Link>
              <Link
                className="text-sm font-medium hover:underline underline-offset-4"
                href="/contact"
              >
                Contact
              </Link>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  );
};
