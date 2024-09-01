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
import { H1, H3, Large } from "./ui/typography";
import { Tables } from "@/types/supabase";
import { api } from "@/trpc/server";
import HandicapTrendChart from "./charts/handicap-trend-chart";
import ScoreBarChart from "./charts/score-bar-chart";

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
        <section className="w-full py-10 md:py-20 lg:py-30 xl:py-40 bg-primary">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center space-y-4 text-center">
              <div className="space-y-2">
                <H1 className="text-primary-foreground">
                  Handicappin&apos; - Golf Made Easy
                </H1>
                <Large className="text-primary-foreground">
                  Golfing is hard enough... so we make everything else as smooth
                  as putter 🤭
                </Large>
              </div>
              <div className="space-x-4 pt-20">
                <H3 className="text-primary-foreground">
                  Your Handicap: {handicapIndex}
                </H3>
              </div>
              {/* <div className="pt-20 pb-24 text-primary-foreground">
                Created by:{" "}
                <Link
                  href="https://soleinnovations.com"
                  className="text-sm text-primary-foreground hover:underline"
                >
                  SoleInnovations
                </Link>
              </div> */}
            </div>
          </div>
        </section>

        <section className="w-full py-12 md:py-24 lg:py-32">
          <div className="container px-4 md:px-6">
            <div className="grid gap-6 lg:grid-cols-2 lg:gap-12">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle>Handicap Trend</CardTitle>
                  <div className="flex items-center space-x-2">
                    <span className="text-2xl font-bold">{handicapIndex}</span>
                    {percentageChange < 0 && (
                      <span className="flex items-center text-sm text-green-500">
                        <ArrowDown className="h-4 w-4 mr-1" />
                        {percentageChange}%
                      </span>
                    )}
                    {percentageChange >= 0 && (
                      <span className="flex items-center text-sm text-red-500">
                        <ArrowUp className="h-4 w-4 mr-1" />+{percentageChange}%
                      </span>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-0 md:min-h-[300px]">
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
                  <CardTitle>Previous Scores</CardTitle>
                </CardHeader>
                <CardContent className="p-0 md:min-h-[300px]">
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

        <section className="w-full py-12 md:py-24 lg:py-32 bg-muted">
          <div className="container px-4 md:px-6">
            <div className="grid gap-10 mx-auto max-w-[800px]">
              <div className="space-y-4">
                <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">
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

        <section className="w-full py-12 md:py-24 lg:py-32">
          <div className="container px-4 md:px-6">
            <Card className="mx-auto max-w-[600px]">
              <CardHeader>
                <CardTitle className="text-2xl font-bold">
                  Register a Round
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="date">Date</Label>
                    <Input id="date" type="date" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="course">Course</Label>
                    <Input
                      id="course"
                      placeholder="Enter course name"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="score">Score</Label>
                    <Input
                      id="score"
                      type="number"
                      placeholder="Enter your score"
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full">
                    <Flag className="mr-2 h-4 w-4" />
                    Submit Round
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>

      <footer className="w-full border-t py-6">
        <div className="container px-4 md:px-6">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <div className="text-center md:text-left flex flex-row">
              <p className="text-sm text-muted-foreground">
                © 2024 Handicappin&apos;. All rights reserved. Developed By:{" "}
                <a href="https://www.soleinnovations.com">SoleInnovations</a>
              </p>
            </div>
            <nav className="flex gap-4 sm:gap-6">
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
