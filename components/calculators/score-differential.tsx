"use client";
import { useEffect, useState } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { calculateScoreDifferential } from "@/lib/handicap";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";
import { InfoIcon } from "lucide-react";

const ScoreDifferentialCalculator = () => {
  const [adjustedGrossScore, setAdjustedGrossScore] = useState(0);
  const [slopeRating, setSlopeRating] = useState(0);
  const [courseRating, setCourseRating] = useState(0);
  const [scoreDifferential, setScoreDifferential] = useState(0);

  useEffect(() => {
    const scoreDifferential = calculateScoreDifferential(
      adjustedGrossScore,
      slopeRating,
      courseRating
    );
    setScoreDifferential(scoreDifferential);
  }, [adjustedGrossScore, slopeRating, courseRating]);

  return (
    <div className="container px-4 lg:px-6">
      <Card className="mx-auto max-w-[600px]">
        <CardHeader>
          <span className="flex flex-row justify-between items-center">
            <CardTitle className="sm:text-2xl text-lg font-bold">
              Score Differential
            </CardTitle>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger className="flex flex-row text-gray-500 items-center">
                  <InfoIcon
                    className={`h-6 w-6 text-gray-500 dark:text-gray-400 mr-2`}
                  />{" "}
                  <span className="sm:block hidden">Whats this?</span>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-[15em]">
                    A <b>Score Differential</b> measures the performance of a
                    round in relation to the relative difficulty of the course
                    that was played and their handicap index. It is used to
                    calculate a player&apos;s handicap index.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </span>

          <CardDescription>Enter the 18 hole score you shot</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Adjusted Gross Score</Label>
            <Input
              id="ags"
              type="number"
              required
              placeholder="95"
              defaultValue={adjustedGrossScore}
              onChange={(e) => setAdjustedGrossScore(Number(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label>Slope Rating</Label>
            <Input
              id="slopeRating"
              placeholder="82"
              type="number"
              required
              onChange={(e) => setSlopeRating(Number(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label>Course Rating</Label>
            <Input
              id="courseRating"
              type="number"
              placeholder="50.3"
              required
              onChange={(e) => setCourseRating(Number(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="score">Score Differential</Label>
            <Input type="number" disabled value={scoreDifferential} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ScoreDifferentialCalculator;
