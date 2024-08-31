"use client";

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
import { BarChart, LineChart, Flag, ArrowUp, ArrowDown } from "lucide-react";
import Link from "next/link";
import { H1, H3, Large, P, Small } from "./ui/typography";

export function HomePage() {
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
                <H3 className="text-primary-foreground">Your Handicap: 12.4</H3>
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
                    <span className="text-2xl font-bold">12.4</span>
                    <span className="flex items-center text-sm text-green-500">
                      <ArrowUp className="h-4 w-4 mr-1" />
                      0.3
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px] flex items-center justify-center bg-muted">
                    <LineChart className="h-16 w-16 text-muted-foreground" />
                    <span className="ml-2 text-muted-foreground">
                      Line Chart Placeholder
                    </span>
                  </div>
                </CardContent>
                <CardFooter className="pt-2">
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
                  <CardTitle>Score Distribution</CardTitle>
                  <div className="flex items-center space-x-2">
                    <span className="text-2xl font-bold">82</span>
                    <span className="flex items-center text-sm text-red-500">
                      <ArrowDown className="h-4 w-4 mr-1" />
                      1.2%
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px] flex items-center justify-center bg-muted">
                    <BarChart className="h-16 w-16 text-muted-foreground" />
                    <span className="ml-2 text-muted-foreground">
                      Bar Chart Placeholder
                    </span>
                  </div>
                </CardContent>
                <CardFooter className="pt-2">
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
                  Improve Your Game
                </h2>
                <p className="text-muted-foreground">
                  Our advanced golf statistics tracking system helps you
                  identify areas for improvement in your game. By analyzing your
                  performance data, you can make informed decisions about your
                  practice routine and strategy on the course.
                </p>
              </div>
              <div className="space-y-4">
                <h3 className="text-2xl font-bold tracking-tighter">
                  Key Features
                </h3>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                  <li>Accurate handicap calculation based on USGA standards</li>
                  <li>Detailed statistics for every aspect of your game</li>
                  <li>Trend analysis to track your progress over time</li>
                  <li>Course management tools to plan your strategy</li>
                </ul>
              </div>
              <div className="space-y-4">
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
              </div>
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
}
