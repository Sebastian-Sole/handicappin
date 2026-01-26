"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { CoursePerformance } from "@/types/statistics";
import { getFlagEmoji } from "@/utils/frivolities/headerGenerator";

interface CourseAnalyticsSectionProps {
  courses: CoursePerformance[];
}

export function CourseAnalyticsSection({ courses }: CourseAnalyticsSectionProps) {
  if (courses.length === 0) {
    return (
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Course Analytics</h2>
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Play more rounds to see course analytics
          </CardContent>
        </Card>
      </section>
    );
  }

  const bestCourse = [...courses].sort(
    (a, b) => a.avgDifferential - b.avgDifferential
  )[0];
  const worstCourse = [...courses].sort(
    (a, b) => b.avgDifferential - a.avgDifferential
  )[0];
  const mostPlayed = courses[0]; // Already sorted by round count

  return (
    <section className="mb-8">
      <h2 className="text-xl font-semibold mb-4">Course Analytics</h2>

      {/* Highlight Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Most Played
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-semibold">
              {getFlagEmoji(mostPlayed.country)} {mostPlayed.courseName}
            </p>
            <p className="text-sm text-muted-foreground">
              {mostPlayed.roundCount} rounds
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Best Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-semibold">
              {getFlagEmoji(bestCourse.country)} {bestCourse.courseName}
            </p>
            <p className="text-sm text-muted-foreground">
              Avg diff: {bestCourse.avgDifferential.toFixed(1)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Challenging Course
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-semibold">
              {getFlagEmoji(worstCourse.country)} {worstCourse.courseName}
            </p>
            <p className="text-sm text-muted-foreground">
              Avg diff: {worstCourse.avgDifferential.toFixed(1)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Full Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Course</TableHead>
                <TableHead className="text-right">Rounds</TableHead>
                <TableHead className="text-right">Avg Diff</TableHead>
                <TableHead className="text-right hidden md:table-cell">Best</TableHead>
                <TableHead className="text-right hidden md:table-cell">
                  Worst
                </TableHead>
                <TableHead className="text-right hidden lg:table-cell">
                  Avg Score
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {courses.map((course) => (
                <TableRow key={course.courseId}>
                  <TableCell>
                    <span className="mr-2">{getFlagEmoji(course.country)}</span>
                    {course.courseName}
                    <span className="text-muted-foreground text-xs ml-2 hidden sm:inline">
                      {course.city}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">{course.roundCount}</TableCell>
                  <TableCell className="text-right">
                    {course.avgDifferential.toFixed(1)}
                  </TableCell>
                  <TableCell className="text-right hidden md:table-cell">
                    {course.bestDifferential.toFixed(1)}
                  </TableCell>
                  <TableCell className="text-right hidden md:table-cell">
                    {course.worstDifferential.toFixed(1)}
                  </TableCell>
                  <TableCell className="text-right hidden lg:table-cell">
                    {Math.round(course.avgScore)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </section>
  );
}
