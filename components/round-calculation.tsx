"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { RoundWithCourse } from "@/types/database";
import { Tables } from "@/types/supabase";
import {
  calculateAdjustedPlayedScore,
  calculateCourseHandicap,
  calculateInputAdjustedGrossScore,
} from "@/utils/calculations/handicap";
import { H2, H3, H4, Large, Lead, Muted, P, Small } from "./ui/typography";
import Link from "next/link";
import HolesTable from "./holesTable";
import { InfoIcon } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";

interface RoundCalculationProps {
  round: RoundWithCourse;
  holes: Tables<"Hole">[];
}

export function RoundCalculation({ round, holes }: RoundCalculationProps) {
  const {
    existingHandicapIndex,
    courseRating,
    courseSlope,
    adjustedGrossScore,
    parPlayed,
    scoreDifferential,
    updatedHandicapIndex,
    totalStrokes,
    courseEighteenHolePar,
  } = round;

  const [par, setPar] = useState(courseEighteenHolePar);
  const [holesPlayed, setHolesPlayed] = useState(holes.length);
  const [handicapIndex, setHandicapIndex] = useState(
    round.existingHandicapIndex
  );
  const [slope, setSlope] = useState(round.courseSlope);
  const [rating, setRating] = useState(round.courseRating);
  const [isNineHoles, setIsNineHoles] = useState(holesPlayed === 9);
  const [adjustedPlayedScore, setAdjustedPlayedScore] = useState(
    calculateAdjustedPlayedScore(holes)
  );

  const courseHandicapCalculation = useMemo(() => {
    if (isNineHoles) {
      return (handicapIndex / 2) * (slope / 113) + (rating - par) / 2;
    } else {
      return handicapIndex * (slope / 113) + (rating - par);
    }
  }, [handicapIndex, slope, rating, par, isNineHoles]);
  const adjustedGrossScoreCalculation = useMemo(() => {
    return calculateInputAdjustedGrossScore(
      adjustedPlayedScore,
      handicapIndex,
      slope,
      rating,
      par,
      holesPlayed
    );
  }, [
    adjustedPlayedScore,
    courseHandicapCalculation,
    par,
    holesPlayed,
    isNineHoles,
  ]);

  const courseHcpStat = calculateCourseHandicap(
    existingHandicapIndex,
    courseSlope,
    courseRating,
    courseEighteenHolePar
  );

  const apsStat = calculateAdjustedPlayedScore(holes);

  return (
    <div className="container mx-auto px-4 sm:px-6 md:px-8 py-8 space-y-8">
      <section className="space-y-4">
        <H2>
          {`${round.courseName} - ${new Date(
            round.teeTime
          ).toDateString()} - Score: ${round.adjustedGrossScore}`}
        </H2>
        <H3>Hole-by-hole results</H3>
        <div className="bg-background rounded-lg border">
          <HolesTable holes={holes} />
        </div>
      </section>
      <section className="space-y-4">
        <H3>Individual Statistic Calculations</H3>
        <div className="bg-background rounded-lg border p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Large>
              Course Handicap:{" "}
              {holesPlayed === 9
                ? Math.round(courseHcpStat / 2)
                : Math.round(courseHcpStat)}
            </Large>
            <Muted>Additional handicap strokes you received this round</Muted>
          </div>
          <div>
            <Large>Adjusted Played Score: {apsStat}</Large>
            <Muted>
              Your played score adjusted such that every hole maxes out at par +
              net bogey (incl. hcp)
            </Muted>
          </div>
          <div>
            <Large>Adjusted Gross Score: {adjustedGrossScore}</Large>
            <Muted>
              Your score adjusted for 18 holes, factoring in expected score for
              rounds with fewer than 18 holes played.
            </Muted>
          </div>
          <div>
            <Large>
              Score Differential:{" "}
              {Math.round(round.scoreDifferential * 10) / 10}
            </Large>
            <Muted>
              Your performance of the round in relation to the relative
              difficulty of the course that was played, i.e. the handicap you
              played to.
            </Muted>
          </div>
        </div>
      </section>
      <section className="space-y-4">
        <div className="flex flex-row">
          <H3>Course Handicap</H3>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                {" "}
                <InfoIcon className="h-5 w-5 text-gray-950 dark:text-gray-400 ml-2" />{" "}
              </TooltipTrigger>
              <TooltipContent>
                <p>Enter 18 hole values</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
          <div>
            <Label>Handicap Index:</Label>
            <Input
              placeholder="Handicap Index"
              value={handicapIndex !== 0 ? handicapIndex : ""}
              type="number"
              onChange={(e) =>
                setHandicapIndex(Number.parseFloat(e.target.value) || 0)
              }
            />
          </div>
          <div>
            <Label>Slope:</Label>
            <Input
              placeholder="Slope"
              value={slope !== 0 ? slope : ""}
              onChange={(e) => setSlope(Number.parseFloat(e.target.value) || 0)}
            />
          </div>
          <div>
            <Label>Course Rating:</Label>
            <Input
              placeholder="Course Rating"
              value={rating !== 0 ? rating : ""}
              type="number"
              onChange={(e) => {
                setRating(Number.parseFloat(e.target.value) || 0);
              }}
            />
          </div>
          <div>
            <Label>Par:</Label>
            <Input
              placeholder="Par"
              value={par !== 0 ? par : ""}
              onChange={(e) => {
                try {
                  setPar(Number(e.target.value) || 0);
                } catch {
                  setPar(par);
                }
              }}
            />
          </div>
          <div className="flex items-center space-x-2">
            <Label>18 holes</Label>
            <Switch
              id="holes"
              checked={isNineHoles}
              onCheckedChange={(e) => {
                setIsNineHoles(e);
                setHolesPlayed(e ? 9 : 18);
              }}
            />
            <Label>9 holes</Label>
          </div>
        </div>
        <div>
          <Label>Calculated Course Handicap:</Label>
          <Input
            placeholder="Calculated Course Handicap"
            value={Math.round(courseHandicapCalculation)}
            readOnly
          />
        </div>
        <Muted className="mb-2">
          {isNineHoles
            ? `Course Handicap 9 holes = handicap index/2 * (slope/113) + (course rating - par)/2`
            : `Course Handicap 18 holes = handicap index * (slope/113) + (course
          rating - par)`}
        </Muted>
      </section>
      <section className="space-y-4">
        <H3 className="text-lg font-medium">Adjusted Gross Score</H3>
        <p className="mb-2">
          Score Differential = adjusted played score + course handicap for
          remaining holes + par for remaining holes
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div>
            <div className="flex flex-row items-center">
              <Label>Adjusted Played Score:</Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    {" "}
                    <InfoIcon className="h-5 w-5 text-gray-500 dark:text-gray-400 ml-2" />{" "}
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Max: par + net double bogey (incl. handicap)</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Input
              placeholder="Adjusted Played Score"
              value={adjustedPlayedScore !== 0 ? adjustedPlayedScore : ""}
              onChange={(e) => {
                try {
                  setAdjustedPlayedScore(Number(e.target.value) || 0);
                } catch {
                  setAdjustedPlayedScore(adjustedPlayedScore);
                }
              }}
            />
          </div>
          <div>
            <Label>Course Handicap (total):</Label>
            <Input
              placeholder="Course Handicap (total)"
              value={Math.round(courseHandicapCalculation)}
              readOnly
            />
          </div>
          <div>
            <Label>Par (18 holes):</Label>
            <Input
              placeholder="Par (18 holes)"
              value={par !== 0 ? par : ""}
              onChange={(e) => {
                try {
                  setPar(Number(e.target.value) || 0);
                } catch {
                  setPar(par);
                }
              }}
            />
          </div>
          <div>
            <Label>Holes Played:</Label>
            <Input
              placeholder="Holes Played"
              value={isNineHoles ? 9 : 18}
              readOnly
            />
          </div>
        </div>
        <div>
          <Label>Adjusted Gross Score:</Label>
          {/* TODO: Update this damn formula */}
          <p>
            Adjuted Gross Score = {adjustedPlayedScore} +{" "}
            {Math.round(courseHandicapCalculation)} + ({par}*(18 - {holesPlayed}
            ) / 18) = {adjustedGrossScoreCalculation}
          </p>
        </div>
        <p className="text-sm text-muted-foreground">
          Adjusted Gross Score = Adjusted Played Score + Course Handicap + (Par
          * (18 - Holes Played) / 18)
        </p>
      </section>
      <section className="space-y-4">
        <H3>Score Differential</H3>
        <p className="mb-2">
          Score Differential = (Adjusted Gross Score - Course Rating) * (113 /
          Slope)
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <Label>Adjusted Gross Score:</Label>
            <Input
              placeholder="Adjusted Gross Score"
              value={adjustedGrossScoreCalculation}
              readOnly
            />
          </div>
          <div>
            <Label>Course Rating:</Label>
            <Input
              placeholder="Course Rating"
              value={rating !== 0 ? rating : ""}
              type="number"
              onChange={(e) =>
                setRating(Number.parseFloat(e.target.value) || 0)
              }
            />
          </div>
          <div>
            <Label>Slope:</Label>
            <Input
              placeholder="Slope"
              value={slope !== 0 ? slope : ""}
              onChange={(e) => setSlope(Number(e.target.value) || 0)}
            />
          </div>
        </div>
        <div>
          <Label>Calculated Score Differential:</Label>
          <Input
            placeholder="Calculated Score Differential"
            value={
              Math.round(
                (((adjustedGrossScoreCalculation - rating) * 113) / slope) * 10
              ) / 10
            }
            readOnly
          />
        </div>
        <p className="text-sm text-muted-foreground">
          Score Differential = (Adjusted Gross Score - Course Rating) * 113 /
          Slope
        </p>
        <H4>How did this affect my handicap?</H4>
        <p>
          Your handicap index at the time this round was registered:{" "}
          {round.existingHandicapIndex}
        </p>
        <p>
          Your new handicap index after this round: {round.updatedHandicapIndex}
        </p>
        <p>
          Your handicap index adjusts if the round registered is one of your 8
          best rounds in your last 20 played. If you&apos;ve played less than 20
          rounds, there is a different calculation which can be viewed here:{" "}
          <Link
            href={
              "https://www.usga.org/handicapping/roh/Content/rules/5%202%20Calculation%20of%20a%20Handicap%20Index.htm"
            }
            target="_blank"
          >
            <Button className="p-0" variant="link">
              UGSA Handicap Rules
            </Button>
          </Link>
        </p>
      </section>
    </div>
  );
}
