"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { RoundWithCourse } from "@/types/database";
import { Tables } from "@/types/supabase";

interface RoundCalculationProps {
  round: RoundWithCourse;
  holes: Tables<"Hole">[];
}

export function RoundCalculation({ round, holes }: RoundCalculationProps) {
  const [fairwaysHit, setFairwaysHit] = useState(12);
  const [fairwaysTotal, setFairwaysTotal] = useState(14);
  const [greensInReg, setGreensInReg] = useState(14);
  const [greensTotal, setGreensTotal] = useState(18);
  const [putts, setPutts] = useState(30);
  const [sandSaves, setSandSaves] = useState(2);
  const [sandSavesTotal, setSandSavesTotal] = useState(3);
  const [par, setPar] = useState(72);
  const [score, setScore] = useState(90);
  const [adjustedHoleScore, setAdjustedHoleScore] = useState(90);
  const [handicapIndex, setHandicapIndex] = useState(18);
  const [slope, setSlope] = useState(120);
  const [courseRating, setCourseRating] = useState(72);
  const [isNineHoles, setIsNineHoles] = useState(false);
  const [adjustedPlayedScore, setAdjustedPlayedScore] = useState(90);
  const [courseHandicap, setCourseHandicap] = useState(12);
  const [holesPlayed, setHolesPlayed] = useState(18);
  const fairwaysHitPercentage = useMemo(() => {
    return ((fairwaysHit / fairwaysTotal) * 100).toFixed(2);
  }, [fairwaysHit, fairwaysTotal]);
  const greensInRegPercentage = useMemo(() => {
    return ((greensInReg / greensTotal) * 100).toFixed(2);
  }, [greensInReg, greensTotal]);
  const sandSavePercentage = useMemo(() => {
    return ((sandSaves / sandSavesTotal) * 100).toFixed(2);
  }, [sandSaves, sandSavesTotal]);
  const courseHandicapCalculation = useMemo(() => {
    if (isNineHoles) {
      return Math.round(
        (handicapIndex / 2) * (slope / 113) + (courseRating - par) / 2
      );
    } else {
      return Math.round(handicapIndex * (slope / 113) + (courseRating - par));
    }
  }, [handicapIndex, slope, courseRating, par, isNineHoles]);
  const adjustedGrossScoreCalculation = useMemo(() => {
    return (
      adjustedPlayedScore + courseHandicap + (par * (holesPlayed - 18)) / 18
    );
  }, [adjustedPlayedScore, courseHandicap, par, holesPlayed]);
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Hole</TableHead>
                <TableHead>Par</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Adjusted Hole Score</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>1</TableCell>
                <TableCell>4</TableCell>
                <TableCell>5</TableCell>
                <TableCell>5</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>2</TableCell>
                <TableCell>3</TableCell>
                <TableCell>4</TableCell>
                <TableCell>4</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>3</TableCell>
                <TableCell>5</TableCell>
                <TableCell>6</TableCell>
                <TableCell>6</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>4</TableCell>
                <TableCell>4</TableCell>
                <TableCell>4</TableCell>
                <TableCell>4</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>5</TableCell>
                <TableCell>3</TableCell>
                <TableCell>3</TableCell>
                <TableCell>3</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>6</TableCell>
                <TableCell>4</TableCell>
                <TableCell>5</TableCell>
                <TableCell>5</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>7</TableCell>
                <TableCell>4</TableCell>
                <TableCell>4</TableCell>
                <TableCell>4</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>8</TableCell>
                <TableCell>3</TableCell>
                <TableCell>3</TableCell>
                <TableCell>3</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>9</TableCell>
                <TableCell>5</TableCell>
                <TableCell>5</TableCell>
                <TableCell>5</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </section>
      <section className="space-y-4">
        <h3 className="text-lg font-medium">
          Individual Statistic Calculations
        </h3>
        <div className="bg-background rounded-lg border p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <h4 className="text-lg font-medium mb-2">Fairways Hit</h4>
            <p>
              {fairwaysHit}/{fairwaysTotal} ({fairwaysHitPercentage}%)
            </p>
            <p className="text-sm text-muted-foreground">
              Fairways Hit / Total Fairways = {fairwaysHitPercentage}%
            </p>
          </div>
          <div>
            <h4 className="text-lg font-medium mb-2">Greens in Regulation</h4>
            <p>
              {greensInReg}/{greensTotal} ({greensInRegPercentage}%)
            </p>
            <p className="text-sm text-muted-foreground">
              Greens in Regulation / Total Greens = {greensInRegPercentage}%
            </p>
          </div>
          <div>
            <h4 className="text-lg font-medium mb-2">Putts</h4>
            <p>{putts}</p>
          </div>
          <div>
            <h4 className="text-lg font-medium mb-2">Sand Saves</h4>
            <p>
              {sandSaves}/{sandSavesTotal} ({sandSavePercentage}%)
            </p>
            <p className="text-sm text-muted-foreground">
              Sand Saves / Total Sand Shots = {sandSavePercentage}%
            </p>
          </div>
        </div>
      </section>
      <section className="space-y-4">
        <h3 className="text-lg font-medium">Adjusted Played Score</h3>
        <p className="mb-2">
          Adjust each hole score so the max score is par + net double bogey
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <Label>Par:</Label>
            <Input
              placeholder="Par"
              value={par}
              onChange={(e) => setPar(Number(e.target.value))}
            />
          </div>
          <div>
            <Label>Score:</Label>
            <Input
              placeholder="Score"
              value={score}
              onChange={(e) => setScore(Number(e.target.value))}
            />
          </div>
          <div>
            <Label>Adjusted Hole Score:</Label>
            <Input
              placeholder="Adjusted Hole Score"
              value={adjustedHoleScore}
              onChange={(e) => setAdjustedHoleScore(Number(e.target.value))}
            />
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Adjusted Hole Score = min(Score, Par + 2)
        </p>
      </section>
      <section className="space-y-4">
        <h3 className="text-lg font-medium">Course Handicap</h3>
        <p className="mb-2">
          Course Handicap 18 holes = handicap index * (slope/113) + (course
          rating - par)
        </p>
        <p className="mb-2">
          Course Handicap 9 holes = handicap index/2 * (slope/113) + (course
          rating - par)/2
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
          <div>
            <Label>Handicap Index:</Label>
            <Input
              placeholder="Handicap Index"
              value={handicapIndex}
              onChange={(e) => setHandicapIndex(Number(e.target.value))}
            />
          </div>
          <div>
            <Label>Slope:</Label>
            <Input
              placeholder="Slope"
              value={slope}
              onChange={(e) => setSlope(Number(e.target.value))}
            />
          </div>
          <div>
            <Label>Course Rating:</Label>
            <Input
              placeholder="Course Rating"
              value={courseRating}
              onChange={(e) => setCourseRating(Number(e.target.value))}
            />
          </div>
          <div>
            <Label>Par:</Label>
            <Input
              placeholder="Par"
              value={par}
              onChange={(e) => setPar(Number(e.target.value))}
            />
          </div>
          <div className="flex items-center space-x-2">
            <Label>9 holes</Label>
            <Switch
              id="holes"
              checked={isNineHoles}
              onCheckedChange={setIsNineHoles}
            />
            <Label>18 holes</Label>
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
              value={adjustedPlayedScore}
              onChange={(e) => setAdjustedPlayedScore(Number(e.target.value))}
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
              value={par}
              onChange={(e) => setPar(Number(e.target.value))}
            />
          </div>
          <div>
            <Label>Holes Played:</Label>
            <Input
              placeholder="Holes Played"
              value={holesPlayed}
              onChange={(e) => setHolesPlayed(Number(e.target.value))}
            />
          </div>
        </div>
        <div>
          <Label>Adjusted Gross Score:</Label>
          <Input
            placeholder="Adjusted Gross Score"
            value={adjustedGrossScoreCalculation}
            readOnly
          />
        </div>
        <p className="text-sm text-muted-foreground">
          Adjusted Gross Score = Adjusted Played Score + Course Handicap + (Par
          * (Holes Played - 18) / 18)
        </p>
      </section>
    </div>
  );
}
