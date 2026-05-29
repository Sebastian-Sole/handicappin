"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Input } from "../ui/input";
import {
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
  Table,
} from "../ui/table";
import { Button } from "../ui/button";
import RoundTablePagination from "./roundTablePagination";
import { ScorecardWithRound } from "@/types/scorecard-input";
import { H2 } from "../ui/typography";
import { EmptyState } from "@/components/ui/empty-state";
import { ListChecks } from "lucide-react";

interface RoundsTableProps {
  scorecards: ScorecardWithRound[];
  title?: string;
  showSearch?: boolean;
  showPagination?: boolean;
}

export function RoundsTable({
  scorecards,
  title = "Rounds History",
  showSearch = true,
  showPagination = true,
}: RoundsTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortColumn, setSortColumn] = useState<
    | "teeTime"
    | "course.name"
    | "round.adjustedGrossScore"
    | "round.parPlayed"
    | "round.scoreDifferential"
    | "round.exceptionalScoreAdjustment"
  >("teeTime");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);

  const filteredAndSortedScorecards = useMemo(() => {
    const filteredScorecards = scorecards
      .filter((scorecard) => {
        return (
          scorecard.teeTime.toLowerCase().includes(searchTerm.toLowerCase()) ||
          scorecard.course.name
            .toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          scorecard.round.adjustedGrossScore.toString().includes(searchTerm) ||
          scorecard.round.parPlayed.toString().includes(searchTerm)
        );
      })
      .sort((a, b) => {
        let columnA, columnB;
        switch (sortColumn) {
          case "course.name":
            columnA = a.course.name;
            columnB = b.course.name;
            break;
          case "round.adjustedGrossScore":
            columnA = a.round.adjustedGrossScore;
            columnB = b.round.adjustedGrossScore;
            break;
          case "round.parPlayed":
            columnA = a.round.parPlayed;
            columnB = b.round.parPlayed;
            break;
          case "round.scoreDifferential":
            columnA = a.round.scoreDifferential;
            columnB = b.round.scoreDifferential;
            break;
          case "round.exceptionalScoreAdjustment":
            columnA = a.round.exceptionalScoreAdjustment;
            columnB = b.round.exceptionalScoreAdjustment;
            break;
          default:
            columnA = a[sortColumn];
            columnB = b[sortColumn];
        }
        if (columnA == null || columnB == null) return 0;
        if (columnA < columnB) return sortDirection === "asc" ? -1 : 1;
        if (columnA > columnB) return sortDirection === "asc" ? 1 : -1;
        return 0;
      });
    return filteredScorecards.slice(page * 20, page * 20 + 20);
  }, [scorecards, searchTerm, sortColumn, sortDirection, page]);

  const handleSort = (column: typeof sortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const ariaSortFor = (
    column: typeof sortColumn
  ): "ascending" | "descending" | "none" => {
    if (sortColumn !== column) return "none";
    return sortDirection === "asc" ? "ascending" : "descending";
  };

  return (
    <div className="surface p-lg">
      <H2 className="mb-md">{title}</H2>

      {showSearch && (
        <div className="mb-md" id="table">
          <Input
            type="search"
            placeholder="Search rounds..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(0);
            }}
            className="w-full rounded-lg bg-background pl-md"
          />
        </div>
      )}

      {filteredAndSortedScorecards.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-inherit">
              {(
                [
                  { column: "teeTime", label: "Date" },
                  { column: "course.name", label: "Course" },
                  { column: "round.adjustedGrossScore", label: "Score" },
                  { column: "round.parPlayed", label: "Par" },
                  { column: "round.scoreDifferential", label: "Differential" },
                  {
                    column: "round.exceptionalScoreAdjustment",
                    label: "Adjustment",
                  },
                ] as const
              ).map(({ column, label }) => (
                <TableHead
                  key={column}
                  aria-sort={ariaSortFor(column)}
                  className="whitespace-nowrap p-0"
                >
                  <button
                    type="button"
                    onClick={() => handleSort(column)}
                    className="flex w-full items-center gap-xs whitespace-nowrap rounded-md px-md py-sm font-bold text-primary transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background cursor-pointer"
                  >
                    {label}
                    <span
                      aria-hidden="true"
                      className="opacity-0 transition-opacity"
                      style={{ opacity: sortColumn === column ? 1 : 0 }}
                    >
                      {sortDirection === "asc" ? "\u2191" : "\u2193"}
                    </span>
                  </button>
                </TableHead>
              ))}
              <TableHead className="font-bold text-primary">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSortedScorecards.map((scorecard, index) => (
              <TableRow key={index} className="hover:bg-accent/20">
                <TableCell>
                  {new Date(scorecard.teeTime).toLocaleString()}
                </TableCell>
                <TableCell>{scorecard.course.name}</TableCell>
                <TableCell>{scorecard.round.adjustedGrossScore}</TableCell>
                <TableCell>{scorecard.round.parPlayed}</TableCell>
                <TableCell>
                  {Math.round(scorecard.round.scoreDifferential * 10) / 10}
                </TableCell>
                <TableCell>
                  {scorecard.round.exceptionalScoreAdjustment
                    ? Math.round(
                        scorecard.round.exceptionalScoreAdjustment * 10
                      ) / 10
                    : 0}
                </TableCell>
                <TableCell>
                  <Link href={`/rounds/${scorecard.round.id}/calculation`}>
                    <Button
                      variant="link"
                      className="text-primary underline px-0"
                    >
                      {" "}
                      View Calculation
                    </Button>
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : scorecards.length === 0 ? (
        <EmptyState
          icon={<ListChecks className="h-5 w-5" />}
          title="No rounds logged yet"
          description="Start tracking your handicap by adding your first round."
          action={
            <Link href="/rounds/add">
              <Button>Add Your First Round</Button>
            </Link>
          }
        />
      ) : (
        <div className="mt-md text-center">
          <p className="text-muted-foreground">
            No rounds found for search: &quot;{searchTerm}&quot;
          </p>
        </div>
      )}

      {showPagination && scorecards.length > 20 && (
        <RoundTablePagination
          page={page}
          setPage={setPage}
          scorecards={scorecards}
        />
      )}
    </div>
  );
}
