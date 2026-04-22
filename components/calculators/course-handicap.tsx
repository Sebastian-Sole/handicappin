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
import { WhatsThis } from "../ui/whats-this";

interface CourseHandicapCalculatorProps {
  handicapIndex: number;
}

const CourseHandicapCalculator = ({
  handicapIndex: hcp,
}: CourseHandicapCalculatorProps) => {
  const [handicapIndex, setHandicapIndex] = useState(hcp);
  const [slopeRating, setSlopeRating] = useState(0);
  const [courseRating, setCourseRating] = useState(0);
  const [par, setPar] = useState(0);
  const [numberOfHolesPlayed] = useState(18);

  const courseHandicap = useMemo(() => {
    if (numberOfHolesPlayed === 9) {
      const adjustedHandicapIndex = Math.round((handicapIndex / 2) * 10) / 10;
      return Math.round(
        adjustedHandicapIndex * (slopeRating / 113) + (courseRating - par)
      );
    }
    return Math.round(
      handicapIndex * (slopeRating / 113) + (courseRating - par)
    );
  }, [handicapIndex, slopeRating, courseRating, par, numberOfHolesPlayed]);

  return (
    <div className="container px-md lg:px-lg">
      <Card className="mx-auto max-w-[600px]">
        <CardHeader>
          <span className="flex flex-row justify-between items-center">
            <CardTitle className="text-heading-4 sm:text-heading-3">
              Course Handicap
            </CardTitle>

            <WhatsThis>
              A <b>Course Handicap</b> is the amount of handicap strokes you
              have on a specific course, based on your handicap index
            </WhatsThis>
          </span>

          <CardDescription>Enter 18 Hole Values</CardDescription>
        </CardHeader>
        <CardContent className="space-y-md">
          <div className="space-y-sm">
            <Label>Handicap Index</Label>
            <Input
              id="handicapIndex"
              type="number"
              required
              placeholder="54"
              defaultValue={handicapIndex}
              onChange={(e) => setHandicapIndex(Number(e.target.value))}
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
            <Label>Par</Label>
            <Input
              id="par"
              type="number"
              placeholder="72"
              required
              onChange={(e) => setPar(Number(e.target.value))}
            />
          </div>
          <div className="space-y-sm">
            <Label htmlFor="score">Course Handicap</Label>
            <Input type="number" disabled value={courseHandicap} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CourseHandicapCalculator;
