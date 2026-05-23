import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { H1, H2, Muted } from "@/components/ui/typography";
import { CourseHoleTabs } from "@/components/statistics/courses/course-hole-tabs";
import {
  formatDifferential,
  formatScore,
  formatWithSign,
} from "@/lib/statistics/format-utils";
import { api } from "@/trpc/server";
import { createServerComponentClient } from "@/utils/supabase/server";
import { getFlagEmoji } from "@/utils/frivolities/headerGenerator";

interface PageProps {
  params: Promise<{ courseId: string }>;
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

const holesPlayedLabel = (
  holesPlayed: number,
  section: "front" | "back" | null,
) => {
  if (holesPlayed === 18) return "18";
  return section === "back" ? "9 (back)" : "9 (front)";
};

export default async function CourseDetailPage({ params }: PageProps) {
  const { courseId: courseIdParam } = await params;
  const courseId = Number(courseIdParam);
  if (!Number.isInteger(courseId) || courseId <= 0) notFound();

  const supabase = await createServerComponentClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/sign-in");

  const detail = await api.stats.getCourseDetail({ courseId });
  if (!detail) notFound();

  const { course, summary, rounds, holes } = detail;
  const hasData = summary.roundCount > 0;

  return (
    <main className="container mx-auto max-w-6xl px-md py-xl space-y-xl">
      <div>
        <Link
          href="/statistics"
          className="inline-flex items-center gap-xs text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to statistics
        </Link>
      </div>

      <header className="space-y-xs">
        <Muted className="uppercase tracking-wide text-xs">Course</Muted>
        <H1>
          <span className="mr-sm">{getFlagEmoji(course.country)}</span>
          {course.name}
        </H1>
        <Muted>
          {course.city}, {course.country}
        </Muted>
      </header>

      {!hasData ? (
        <Card>
          <CardContent className="p-2xl text-center text-muted-foreground">
            <div className="text-4xl mb-md">⛳</div>
            <p className="text-lg font-medium">No rounds at this course yet</p>
            <p className="text-sm">Log a round here to start building stats.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <section className="grid grid-cols-2 md:grid-cols-4 gap-md">
            <Card>
              <CardContent className="p-md text-center">
                <p className="text-sm text-muted-foreground">Rounds</p>
                <p className="text-figure-lg">{summary.roundCount}</p>
                <p className="text-xs text-muted-foreground">played here</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-md text-center">
                <p className="text-sm text-muted-foreground">Avg Score</p>
                <p className="text-figure-lg">{formatScore(summary.avgScore)}</p>
                <p className="text-xs text-muted-foreground">
                  across {summary.roundCount} round
                  {summary.roundCount !== 1 ? "s" : ""}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-md text-center">
                <p className="text-sm text-muted-foreground">Avg Differential</p>
                <p className="text-figure-lg">
                  {formatDifferential(summary.avgDifferential)}
                </p>
                <p className="text-xs text-muted-foreground">lower is better</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-md text-center">
                <p className="text-sm text-muted-foreground">Best / Worst Diff</p>
                <p className="text-figure-lg">
                  {formatDifferential(summary.bestDifferential)}
                  <span className="text-muted-foreground mx-xs">/</span>
                  {formatDifferential(summary.worstDifferential)}
                </p>
                <p className="text-xs text-muted-foreground">spread</p>
              </CardContent>
            </Card>
          </section>

          <Separator />

          <section className="space-y-md">
            <div>
              <H2 className="text-heading-3 pb-0">Hole-by-hole averages</H2>
              <Muted className="mt-xs">
                Aggregated across your {summary.roundCount} round
                {summary.roundCount !== 1 ? "s" : ""} here. Switch tabs to view
                as a table, average score chart, or scoring distribution.
              </Muted>
            </div>
            <CourseHoleTabs holes={holes} />
          </section>

          <Separator />

          <section className="space-y-md">
            <div>
              <H2 className="text-heading-3 pb-0">Rounds at {course.name}</H2>
              <Muted className="mt-xs">
                Click a round to view the full scorecard.
              </Muted>
            </div>
            <Card>
              <CardContent className="p-0 overflow-x-auto">
                <Table className="min-w-[560px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Tee</TableHead>
                      <TableHead className="text-right">Holes</TableHead>
                      <TableHead className="text-right">Score</TableHead>
                      <TableHead className="text-right">vs Par</TableHead>
                      <TableHead className="text-right">Differential</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rounds.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>
                          <Link
                            href={`/rounds/${r.id}/calculation`}
                            className="underline-offset-2 hover:underline"
                          >
                            {formatDate(r.teeTime)}
                          </Link>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {r.teeName}
                        </TableCell>
                        <TableCell className="text-right">
                          {holesPlayedLabel(r.holesPlayed, r.nineHoleSection)}
                        </TableCell>
                        <TableCell className="text-right">
                          {r.totalStrokes}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatWithSign(r.totalStrokes - r.parPlayed, 0)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatDifferential(r.scoreDifferential)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </section>
        </>
      )}
    </main>
  );
}
