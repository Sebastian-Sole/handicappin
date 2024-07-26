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
import { H3, H4, Muted } from "./ui/typography";
import Link from "next/link";
import HolesTable from "./holesTable";
import { InfoIcon } from "lucide-react";

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

  const [par, setPar] = useState(round.parPlayed);
  const [holesPlayed, setHolesPlayed] = useState(holes.length);
  const [handicapIndex, setHandicapIndex] = useState(
    round.existingHandicapIndex
  );
  const [slope, setSlope] = useState(round.courseSlope);
  const [rating, setRating] = useState(round.courseRating);
  const [isNineHoles, setIsNineHoles] = useState(holesPlayed === 9);
  const [adjustedPlayedScore, setAdjustedPlayedScore] = useState(0);

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
        <h2 className="text-xl font-semibold">
          {`${round.courseName} - ${new Date(
            round.teeTime
          ).toDateString()} - Score: ${round.adjustedGrossScore}`}
        </h2>
        <h3 className="text-lg font-medium">Hole-by-hole results</h3>
        <div className="bg-background rounded-lg border">
          <HolesTable holes={holes} />
        </div>
      </section>
      <section className="space-y-4">
        <h3 className="text-lg font-medium">
          Individual Statistic Calculations
        </h3>
        <div className="bg-background rounded-lg border p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <h4 className="text-lg font-medium mb-2">Course Handicap</h4>
            <p>
              Course HCP:{" "}
              {holesPlayed === 9
                ? Math.round(courseHcpStat / 2)
                : Math.round(courseHcpStat)}
            </p>
          </div>
          <div>
            <h4 className="text-lg font-medium mb-2">Adjusted Played Score</h4>
            <p>APS: {apsStat}</p>
          </div>
          <div>
            <h4 className="text-lg font-medium mb-2">Adjusted Gross Score</h4>
            <p>AGS: {adjustedGrossScore}</p>
          </div>
          <div>
            <h4 className="text-lg font-medium mb-2">Score Differential</h4>
            <p>
              Score Differential:{" "}
              {Math.round(round.scoreDifferential * 10) / 10}
            </p>
          </div>
        </div>
      </section>
      <section className="space-y-4">
        <h3 className="text-lg font-medium">Course Handicap</h3>
        <Muted className="mb-2">
          Course Handicap 18 holes = handicap index * (slope/113) + (course
          rating - par)
        </Muted>
        <Muted className="mb-2">
          Course Handicap 9 holes = Course Handicap 18 holes&#247;2
        </Muted>
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
              onChange={(e) => setPar(Number(e.target.value) || par)}
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
            value={courseHandicapCalculation}
            readOnly
          />
        </div>
        <p className="text-sm text-muted-foreground">
          {isNineHoles
            ? `Course Handicap 9 holes = handicap index/2 * (slope/113) + (course rating - par)/2`
            : `Course Handicap 18 holes = handicap index * (slope/113) + (course rating - par)`}
        </p>
      </section>
      <section className="space-y-4">
        <h3 className="text-lg font-medium">Adjusted Gross Score</h3>
        <p className="mb-2">
          Score Differential = adjusted played score + course handicap for
          remaining holes + par for remaining holes
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div>
            <Label>Adjusted Played Score:</Label>
            <Input
              placeholder="Adjusted Played Score"
              value={adjustedPlayedScore !== 0 ? adjustedPlayedScore : ""}
              onChange={(e) =>
                setAdjustedPlayedScore(Number(e.target.value) || 0)
              }
            />
          </div>
          <div>
            <Label>Course Handicap (total):</Label>
            <Input
              placeholder="Course Handicap (total)"
              value={courseHandicapCalculation}
              readOnly
            />
          </div>
          <div>
            <Label>Par (18 holes):</Label>
            <Input
              placeholder="Par (18 holes)"
              value={par !== 0 ? par : ""}
              onChange={(e) => setPar(Number(e.target.value) || par)}
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
          <p>
            Adjuted Gross Score = {adjustedPlayedScore} +{" "}
            {courseHandicapCalculation} + ({par}*(18 - {holesPlayed}) / 18) ={" "}
            {adjustedGrossScoreCalculation}
          </p>
        </div>
        <p className="text-sm text-muted-foreground">
          Adjusted Gross Score = Adjusted Played Score + Course Handicap + (Par
          * (Holes Played - 18) / 18)
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
            value={((adjustedGrossScoreCalculation - rating) * 113) / slope}
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
