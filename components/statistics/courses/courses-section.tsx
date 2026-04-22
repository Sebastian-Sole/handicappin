"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatisticsSection } from "../shared/statistics-section";
import { StatTile } from "@/components/ui/stat-tile";
import { getFlagEmoji } from "@/utils/frivolities/headerGenerator";
import { formatDifferential, formatScore, formatDecimal } from "@/lib/statistics/format-utils";
import type { CoursePerformance } from "@/types/statistics";

interface CoursesSectionProps {
  courses: CoursePerformance[];
  uniqueCourses: number;
  totalRounds: number;
}

export function CoursesSection({
  courses,
  uniqueCourses,
  totalRounds,
}: CoursesSectionProps) {
  if (courses.length === 0) {
    return (
      <Card>
        <CardContent className="p-2xl text-center text-muted-foreground">
          <div className="text-4xl mb-md">🏌️</div>
          <p className="text-lg font-medium">No course data yet</p>
          <p className="text-sm">Play more rounds to see course analytics</p>
        </CardContent>
      </Card>
    );
  }

  const bestCourse = [...courses].sort(
    (a, b) => a.avgDifferential - b.avgDifferential
  )[0];
  const worstCourse = [...courses].sort(
    (a, b) => b.avgDifferential - a.avgDifferential
  )[0];
  const mostPlayed = courses.reduce((max, course) =>
    course.roundCount > max.roundCount ? course : max
  );

  // Calculate variety score (unique courses / total rounds * 100)
  const varietyScore =
    totalRounds > 0 ? Math.round((uniqueCourses / totalRounds) * 100) : 0;

  // Get unique countries
  const uniqueCountries = new Set(courses.map((c) => c.country)).size;

  // Identify home course (most played with 3+ rounds)
  const homeCourse = mostPlayed.roundCount >= 3 ? mostPlayed : null;

  // Find most consistent course (smallest differential spread, min 2 rounds)
  const coursesWithMultipleRounds = courses.filter((c) => c.roundCount >= 2);
  const mostConsistentCourse =
    coursesWithMultipleRounds.length > 0
      ? [...coursesWithMultipleRounds].sort(
          (a, b) =>
            a.worstDifferential -
            a.bestDifferential -
            (b.worstDifferential - b.bestDifferential)
        )[0]
      : null;

  // Find a single-play course to highlight (course with only 1 round)
  const singlePlayCourses = courses.filter((c) => c.roundCount === 1);
  const singlePlayHighlight = singlePlayCourses.length > 0 ? singlePlayCourses[0] : null;

  // Get variety label
  const getVarietyLabel = (score: number): string => {
    if (score >= 70) return "Explorer";
    if (score >= 50) return "Adventurous";
    if (score >= 30) return "Balanced";
    return "Home Course Hero";
  };

  return (
    <div className="space-y-xl">
      {/* Course Overview Section */}
      <StatisticsSection
        icon="⛳"
        title="Course Overview"
        description="Your golfing journey across different courses"
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-md">
          <Card>
            <CardContent className="p-md">
              <StatTile
                value={uniqueCourses}
                label="Courses Played"
                hint="unique courses"
                size="lg"
              />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-md">
              <StatTile
                value={uniqueCountries}
                label="Countries"
                hint={`countr${uniqueCountries !== 1 ? "ies" : "y"} visited`}
                size="lg"
              />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-md">
              <StatTile
                value={`${varietyScore}%`}
                label="Variety Score"
                hint={
                  <>
                    {getVarietyLabel(varietyScore)}
                    <span className="block text-[10px] text-muted-foreground/70 mt-xs">
                      unique courses ÷ total rounds
                    </span>
                  </>
                }
                size="lg"
              />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-md">
              <StatTile
                value={
                  uniqueCourses > 0
                    ? formatDecimal(totalRounds / uniqueCourses, 1)
                    : "—"
                }
                label="Avg Rounds/Course"
                hint="rounds per course"
                size="lg"
              />
            </CardContent>
          </Card>
        </div>
      </StatisticsSection>

      <Separator />

      {/* Course Highlights Section */}
      <StatisticsSection
        icon="🏆"
        title="Course Highlights"
        description="Your most played and best performing courses"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-md">
          {homeCourse && (
            <Card className="tint-info">
              <CardHeader className="pb-sm">
                <CardTitle className="text-sm text-muted-foreground">
                  🏠 Home Course
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-semibold">
                  {getFlagEmoji(homeCourse.country)} {homeCourse.courseName}
                </p>
                <p className="text-sm text-muted-foreground">
                  {homeCourse.roundCount} rounds
                </p>
                <p className="text-xs text-muted-foreground mt-xs">
                  Avg diff: {formatDifferential(homeCourse.avgDifferential)}
                </p>
              </CardContent>
            </Card>
          )}
          <Card className="tint-success">
            <CardHeader className="pb-sm">
              <CardTitle className="text-sm text-muted-foreground">
                ✅ Best Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-semibold">
                {getFlagEmoji(bestCourse.country)} {bestCourse.courseName}
              </p>
              <p className="text-sm text-muted-foreground">
                {bestCourse.roundCount} round{bestCourse.roundCount !== 1 ? "s" : ""}
              </p>
              <p className="text-xs text-success font-medium mt-xs">
                {formatDifferential(bestCourse.avgDifferential)} avg diff
              </p>
            </CardContent>
          </Card>
          <Card className="tint-warning">
            <CardHeader className="pb-sm">
              <CardTitle className="text-sm text-muted-foreground">
                💪 Challenging Course
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-semibold">
                {getFlagEmoji(worstCourse.country)} {worstCourse.courseName}
              </p>
              <p className="text-sm text-muted-foreground">
                {worstCourse.roundCount} round{worstCourse.roundCount !== 1 ? "s" : ""}
              </p>
              <p className="text-xs text-warning font-medium mt-xs">
                {formatDifferential(worstCourse.avgDifferential)} avg diff
              </p>
            </CardContent>
          </Card>
          {mostConsistentCourse && (
            <Card className="tint-primary">
              <CardHeader className="pb-sm">
                <CardTitle className="text-sm text-muted-foreground">
                  🎯 Most Consistent
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-semibold">
                  {getFlagEmoji(mostConsistentCourse.country)}{" "}
                  {mostConsistentCourse.courseName}
                </p>
                <p className="text-sm text-muted-foreground">
                  {mostConsistentCourse.roundCount} rounds
                </p>
                <p className="text-xs text-primary font-medium mt-xs">
                  {(
                    mostConsistentCourse.worstDifferential -
                    mostConsistentCourse.bestDifferential
                  ).toFixed(1)}{" "}
                  diff spread
                </p>
              </CardContent>
            </Card>
          )}
          {!mostConsistentCourse && singlePlayHighlight && (
            <Card className="tint-info">
              <CardHeader className="pb-sm">
                <CardTitle className="text-sm text-muted-foreground">
                  ⛳ Single-Play Course
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-semibold">
                  {getFlagEmoji(singlePlayHighlight.country)} {singlePlayHighlight.courseName}
                </p>
                <p className="text-sm text-muted-foreground">Played once</p>
                <p className="text-xs text-info font-medium mt-xs">
                  {formatDifferential(singlePlayHighlight.avgDifferential)} diff
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </StatisticsSection>

      <Separator />

      {/* All Courses Section */}
      <StatisticsSection
        icon="📋"
        title="All Courses"
        description={`Performance data across ${courses.length} course${courses.length !== 1 ? "s" : ""}`}
        learnMoreContent={
          <p>
            This table shows your performance at each course you&apos;ve played. The
            &quot;Avg Diff&quot; column is your average score differential at that
            course - lower is better. A consistent differential across courses
            indicates steady play, while variations might suggest certain course types
            suit your game better.
          </p>
        }
      >
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table className="min-w-[500px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Course</TableHead>
                  <TableHead className="text-right">Rounds</TableHead>
                  <TableHead className="text-right">Avg Diff</TableHead>
                  <TableHead className="text-right hidden md:table-cell">Best</TableHead>
                  <TableHead className="text-right hidden md:table-cell">Worst</TableHead>
                  <TableHead className="text-right hidden lg:table-cell">
                    Avg Score
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {courses.map((course) => (
                  <TableRow key={course.courseId}>
                    <TableCell>
                      <span className="mr-sm">{getFlagEmoji(course.country)}</span>
                      {course.courseName}
                      <span className="text-muted-foreground text-xs ml-sm hidden sm:inline">
                        {course.city}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">{course.roundCount}</TableCell>
                    <TableCell className="text-right">
                      {formatDifferential(course.avgDifferential)}
                    </TableCell>
                    <TableCell className="text-right hidden md:table-cell">
                      {formatDifferential(course.bestDifferential)}
                    </TableCell>
                    <TableCell className="text-right hidden md:table-cell">
                      {formatDifferential(course.worstDifferential)}
                    </TableCell>
                    <TableCell className="text-right hidden lg:table-cell">
                      {formatScore(course.avgScore)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </StatisticsSection>
    </div>
  );
}
