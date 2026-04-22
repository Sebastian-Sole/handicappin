"use client";
import { useState, useMemo } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { calculateScoreDifferential } from "@handicappin/handicap-core";
import { WhatsThis } from "../ui/whats-this";

const ScoreDifferentialCalculator = () => {
  const [adjustedGrossScore, setAdjustedGrossScore] = useState(0);
  const [slopeRating, setSlopeRating] = useState(0);
  const [courseRating, setCourseRating] = useState(0);

  const scoreDifferential = useMemo(() => {
    return calculateScoreDifferential(adjustedGrossScore, slopeRating, courseRating);
  }, [adjustedGrossScore, slopeRating, courseRating]);

  return (
    <div className="container px-md lg:px-lg">
      <Card className="mx-auto max-w-[600px]">
        <CardHeader>
          <span className="flex flex-row justify-between items-center">
            <CardTitle className="sm:text-2xl text-lg font-bold">
              Score Differential
            </CardTitle>

            <WhatsThis>
              A <b>Score Differential</b> measures the performance of a round
              in relation to the relative difficulty of the course that was
              played and their handicap index. It is used to calculate a
              player&apos;s handicap index.
            </WhatsThis>
          </span>

          <CardDescription>Enter the 18 hole score you shot</CardDescription>
        </CardHeader>
        <CardContent className="space-y-md">
          <div className="space-y-sm">
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
          <div className="space-y-sm">
            <Label>Slope Rating</Label>
            <Input
              id="slopeRating"
              placeholder="82"
              type="number"
              required
              onChange={(e) => setSlopeRating(Number(e.target.value))}
            />
          </div>
          <div className="space-y-sm">
            <Label>Course Rating</Label>
            <Input
              id="courseRating"
              type="number"
              placeholder="50.3"
              required
              onChange={(e) => setCourseRating(Number(e.target.value))}
            />
          </div>
          <div className="space-y-sm">
            <Label htmlFor="score">Score Differential</Label>
            <Input type="number" disabled value={scoreDifferential} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ScoreDifferentialCalculator;
