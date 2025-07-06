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
import { calculateCourseHandicap } from "@/utils/calculations/handicap";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";
import { InfoIcon } from "lucide-react";

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
  const [courseHandicap, setCourseHandicap] = useState(0);
  const [numberOfHolesPlayed, setNumberOfHolesPlayed] = useState(18);

  useEffect(() => {
    if (numberOfHolesPlayed === 9) {
      const adjustedHandicapIndex = Math.round((handicapIndex / 2) * 10) / 10;
      const courseHandicap = Math.round(
        adjustedHandicapIndex * (slopeRating / 113) +
          (courseRating - par)
      );
      setCourseHandicap(courseHandicap);
    } else {
      const courseHandicap = Math.round(
        handicapIndex * (slopeRating / 113) +
          (courseRating - par)
      );
      setCourseHandicap(courseHandicap);
    } 
  }, [handicapIndex, slopeRating, courseRating, par, numberOfHolesPlayed]);


  

  return (
    <div className="container px-4 lg:px-6">
      <Card className="mx-auto max-w-[600px]">
        <CardHeader>
          <span className="flex flex-row justify-between items-center">
            <CardTitle className="sm:text-2xl text-lg font-bold">
              Course Handicap
            </CardTitle>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger className="flex flex-row text-gray-500 items-center">
                  <InfoIcon
                    className={`h-6 w-6 text-gray-500 dark:text-gray-400 mr-2`}
                  />{" "}
                  <span className="sm:block hidden">Whats this? </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-[15em]">
                    A <b>Course Handicap</b> is the amount of handicap strokes
                    you have on a specific course, based on your handicap index
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </span>

          <CardDescription>Enter 18 Hole Values</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
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
            <Label>Par</Label>
            <Input
              id="par"
              type="number"
              placeholder="72"
              required
              onChange={(e) => setPar(Number(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="score">Course Handicap</Label>
            <Input type="number" disabled value={courseHandicap} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CourseHandicapCalculator;
