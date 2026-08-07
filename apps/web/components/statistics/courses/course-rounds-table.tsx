"use client";

import Link from "next/link";

import { QuarantineBadge } from "@/components/billing/quarantine-badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { H2, Muted } from "@/components/ui/typography";
import {
  formatDifferential,
  formatWithSign,
} from "@/lib/statistics/format-utils";

/** One row of `stats.getCourseDetail`'s `rounds` list. */
export interface CourseRoundRow {
  id: number;
  teeTime: string;
  totalStrokes: number;
  parPlayed: number;
  scoreDifferential: number;
  holesPlayed: number;
  nineHoleSection: "front" | "back" | null;
  teeName: string;
  /** Accepted past the free-tier limit — listed, but not counted (D4). */
  quarantined: boolean;
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

interface CourseRoundsTableProps {
  courseName: string;
  /** EVERY round at the course — quarantined ones stay visible (D4). */
  rounds: CourseRoundRow[];
  /** Listed-but-not-counted rounds, for the honesty note in the subhead. */
  quarantinedRounds: number;
  /** Total rounds listed, for the same note. */
  listedRounds: number;
}

/**
 * Per-course rounds list. Quarantined rounds are never filtered out (D4) —
 * each one carries the same badge the homepage activity feed uses, so a
 * non-counting round is never displayed as if it counts toward the summary
 * and per-hole statistics above it. Native twin: the RoundsSection in
 * apps/native/app/(tabs)/statistics/courses/[courseId].tsx.
 */
export function CourseRoundsTable({
  courseName,
  rounds,
  quarantinedRounds,
  listedRounds,
}: CourseRoundsTableProps) {
  return (
    <section className="space-y-md">
      <div>
        <H2 className="text-heading-3 pb-0">Rounds at {courseName}</H2>
        <Muted className="mt-xs">
          Click a round to view the full scorecard.
          {quarantinedRounds > 0
            ? ` ${quarantinedRounds} of ${listedRounds} don't count toward the stats above.`
            : ""}
        </Muted>
      </div>
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table className="min-w-xl">
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
                    {r.quarantined && <QuarantineBadge className="mt-xs" />}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {r.teeName}
                  </TableCell>
                  <TableCell className="text-right">
                    {holesPlayedLabel(r.holesPlayed, r.nineHoleSection)}
                  </TableCell>
                  <TableCell className="text-right">{r.totalStrokes}</TableCell>
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
  );
}
