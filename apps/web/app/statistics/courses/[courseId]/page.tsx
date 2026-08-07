import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { H1, H2, Muted } from "@/components/ui/typography";
import { CourseHoleTabs } from "@/components/statistics/courses/course-hole-tabs";
import { CourseRoundsTable } from "@/components/statistics/courses/course-rounds-table";
import { getCourseDetailDisplay } from "@/lib/statistics/course-detail-display";
import {
  formatDifferential,
  formatScore,
} from "@/lib/statistics/format-utils";
import { api } from "@/trpc/server";
import { createServerComponentClient } from "@/utils/supabase/server";
import { getFlagEmoji } from "@/utils/frivolities/headerGenerator";
import { PageContainer } from "@/components/layout/page-container";

interface PageProps {
  params: Promise<{ courseId: string }>;
}

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
  // Quarantined rounds are listed but not counted (D4) — the two populations
  // differ, so the empty state keys off the LIST and the statistics key off
  // the counted total.
  const display = getCourseDetailDisplay(rounds.length, summary.roundCount);

  return (
    <PageContainer className="space-y-xl">
      <div>
        <Link
          href="/statistics"
          className="inline-flex items-center gap-xs text-body-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to statistics
        </Link>
      </div>

      <header className="space-y-xs">
        <Muted className="text-eyebrow">Course</Muted>
        <H1>
          <span className="mr-sm">{getFlagEmoji(course.country)}</span>
          {course.name}
        </H1>
        <Muted>
          {course.city}, {course.country}
        </Muted>
      </header>

      {display.state === "empty" ? (
        <Card>
          <CardContent>
            <EmptyState
              icon="⛳"
              title="No rounds at this course yet"
              description="Log a round here to start building stats."
            />
          </CardContent>
        </Card>
      ) : display.state === "all-quarantined" ? (
        <>
          {/* Every round here is quarantined: there is nothing to aggregate,
              but the rounds themselves must stay visible (D4). */}
          <Alert>
            <AlertTitle>No stats for this course yet</AlertTitle>
            <AlertDescription>
              {display.listedRounds === 1
                ? "Your round here was saved past the free-tier limit, so it doesn't count toward your handicap or these statistics."
                : `All ${display.listedRounds} of your rounds here were saved past the free-tier limit, so they don't count toward your handicap or these statistics.`}{" "}
              Upgrade to unlock them.
            </AlertDescription>
          </Alert>
          <CourseRoundsTable
            courseName={course.name}
            rounds={rounds}
            quarantinedRounds={display.quarantinedRounds}
            listedRounds={display.listedRounds}
          />
        </>
      ) : (
        <>
          <section className="grid grid-cols-2 md:grid-cols-4 gap-md">
            <Card>
              <CardContent className="p-md text-center">
                <p className="text-body-sm text-muted-foreground">Rounds</p>
                <p className="text-figure-lg">{summary.roundCount}</p>
                <p className="text-meta text-muted-foreground">played here</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-md text-center">
                <p className="text-body-sm text-muted-foreground">Avg Score</p>
                <p className="text-figure-lg">{formatScore(summary.avgScore)}</p>
                <p className="text-meta text-muted-foreground">
                  across {summary.roundCount} round
                  {summary.roundCount !== 1 ? "s" : ""}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-md text-center">
                <p className="text-body-sm text-muted-foreground">Avg Differential</p>
                <p className="text-figure-lg">
                  {formatDifferential(summary.avgDifferential)}
                </p>
                <p className="text-meta text-muted-foreground">lower is better</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-md text-center">
                <p className="text-body-sm text-muted-foreground">Best / Worst Diff</p>
                <p className="text-figure-lg">
                  {formatDifferential(summary.bestDifferential)}
                  <span className="text-muted-foreground mx-xs">/</span>
                  {formatDifferential(summary.worstDifferential)}
                </p>
                <p className="text-meta text-muted-foreground">spread</p>
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

          <CourseRoundsTable
            courseName={course.name}
            rounds={rounds}
            quarantinedRounds={display.quarantinedRounds}
            listedRounds={display.listedRounds}
          />
        </>
      )}
    </PageContainer>
  );
}
