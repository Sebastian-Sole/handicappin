"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

import DashboardInfo from "./dashboardInfo";
import DashboardGraphDisplay from "./dashboardGraphDisplay";
import useMounted from "@/hooks/useMounted";
import { Tables } from "@/types/supabase";
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
import DashboardSkeleton from "./dashboardSkeleton";
import RoundTablePagination from "./roundTablePagination";
import { getRelevantRounds } from "@/utils/calculations/handicap";
import { ScorecardWithRound } from "@/types/scorecard";

interface DashboardProps {
  profile: Tables<"profile">;
  scorecards: ScorecardWithRound[];
  header: string;
}

export function Dashboard({ profile, scorecards, header }: DashboardProps) {
  const isMounted = useMounted();
  const [searchTerm, setSearchTerm] = useState("");
  const [sortColumn, setSortColumn] = useState<
    "teeTime" | "course.name" | "round.adjustedGrossScore" | "round.parPlayed" | "round.scoreDifferential" | "round.exceptionalScoreAdjustment"
  >("teeTime");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);

  const filteredAndSortedScorecards = useMemo(() => {
    const filteredScorecards = scorecards
      .filter((scorecard) => {
        return (
          scorecard.teeTime.toLowerCase().includes(searchTerm.toLowerCase()) ||
          scorecard.course.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
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

  const relevantRoundsList = getRelevantRounds(scorecards.map(scorecard => scorecard.round));

  const sortedGraphData = scorecards
    .map((scorecard) => ({
      roundDate: new Date(scorecard.teeTime).toLocaleDateString(),
      score: scorecard.round.adjustedGrossScore,
      influencesHcp: relevantRoundsList.includes(scorecard.round),
    }))
    .sort((a, b) => {
      return new Date(a.roundDate).getTime() - new Date(b.roundDate).getTime();
    });

  const graphData =
    sortedGraphData.length >= 21
      ? sortedGraphData.slice(-21, -1)
      : sortedGraphData;

  if (!isMounted) return <DashboardSkeleton />;

  return (
    <div className="bg-background text-foreground p-8 rounded-lg h-full">
      <div className="grid grid-cols-1 2xl:grid-cols-3">
        <DashboardInfo handicapIndex={profile.handicapIndex} header={header} />
        <DashboardGraphDisplay graphData={graphData} />
      </div>

      <div className="bg-card rounded-lg p-6 mt-8">
        <h2 className="text-2xl font-bold mb-4">Rounds History</h2>
        <div className="mb-4" id="table">
          <Input
            type="search"
            placeholder="Search rounds..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(0);
            }}
            className="w-full rounded-lg bg-background pl-4"
          />
        </div>

        {filteredAndSortedScorecards.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-inherit">
                <TableHead
                  className="cursor-pointer whitespace-nowrap font-bold text-primary"
                  onClick={() => handleSort("teeTime")}
                >
                  Date{" "}
                  <span className="ml-1 opacity-0 transition-opacity" style={{ opacity: sortColumn === "teeTime" ? 1 : 0 }}>
                    {sortDirection === "asc" ? "\u2191" : "\u2193"}
                  </span>
                </TableHead>
                <TableHead
                  className="cursor-pointer whitespace-nowrap font-bold text-primary"
                  onClick={() => handleSort("course.name")}
                >
                  Course{" "}
                  <span className="ml-1 opacity-0 transition-opacity" style={{ opacity: sortColumn === "course.name" ? 1 : 0 }}>
                    {sortDirection === "asc" ? "\u2191" : "\u2193"}
                  </span>
                </TableHead>
                <TableHead
                  className="cursor-pointer whitespace-nowrap font-bold text-primary"
                  onClick={() => handleSort("round.adjustedGrossScore")}
                >
                  Score{" "}
                  <span className="ml-1 opacity-0 transition-opacity" style={{ opacity: sortColumn === "round.adjustedGrossScore" ? 1 : 0 }}>
                    {sortDirection === "asc" ? "\u2191" : "\u2193"}
                  </span>
                </TableHead>
                <TableHead
                  className="cursor-pointer whitespace-nowrap font-bold text-primary"
                  onClick={() => handleSort("round.parPlayed")}
                >
                  Par{" "}
                  <span className="ml-1 opacity-0 transition-opacity" style={{ opacity: sortColumn === "round.parPlayed" ? 1 : 0 }}>
                    {sortDirection === "asc" ? "\u2191" : "\u2193"}
                  </span>
                </TableHead>
                <TableHead
                  className="cursor-pointer whitespace-nowrap font-bold text-primary"
                  onClick={() => handleSort("round.scoreDifferential")}
                >
                  Differential{" "}
                  <span className="ml-1 opacity-0 transition-opacity" style={{ opacity: sortColumn === "round.scoreDifferential" ? 1 : 0 }}>
                    {sortDirection === "asc" ? "\u2191" : "\u2193"}
                  </span>
                </TableHead>
                <TableHead
                  className="cursor-pointer whitespace-nowrap font-bold text-primary"
                  onClick={() => handleSort("round.exceptionalScoreAdjustment")}
                >
                  Adjustment{" "}
                  <span className="ml-1 opacity-0 transition-opacity" style={{ opacity: sortColumn === "round.exceptionalScoreAdjustment" ? 1 : 0 }}>
                    {sortDirection === "asc" ? "\u2191" : "\u2193"}
                  </span>
                </TableHead>
                <TableHead className="font-bold text-primary">
                  Actions
                </TableHead>
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
                      ? Math.round(scorecard.round.exceptionalScoreAdjustment * 10) / 10
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
        ) : (
          <div className="mt-4 text-center">
            <p>No rounds found for search: &quot;{searchTerm}&quot;</p>
          </div>
        )}

        {scorecards.length > 20 && (
          <RoundTablePagination
            page={page}
            setPage={setPage}
            scorecards={scorecards}
          />
        )}
      </div>
    </div>
  );
}
