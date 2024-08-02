"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

import DashboardInfo from "./dashboardInfo";
import DashboardGraphDisplay from "./dashboardGraphDisplay";
import useMounted from "@/hooks/useMounted";
import { RoundWithCourse } from "@/types/database";
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

interface DashboardProps {
  profile: Tables<"Profile">;
  roundsList: RoundWithCourse[];
  header: string;
}

export function Dashboard({ profile, roundsList, header }: DashboardProps) {
  const isMounted = useMounted();
  const [searchTerm, setSearchTerm] = useState("");
  const [sortColumn, setSortColumn] =
    useState<keyof RoundWithCourse>("teeTime");
  const [sortDirection, setSortDirection] = useState("desc");
  const [page, setPage] = useState(0);

  const filteredAndSortedRounds = useMemo(() => {
    const filteredRounds = roundsList
      .filter((round) => {
        return (
          round.teeTime.toLowerCase().includes(searchTerm.toLowerCase()) ||
          round.courseName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          round.adjustedGrossScore.toString().includes(searchTerm) ||
          round.parPlayed.toString().includes(searchTerm)
        );
      })
      .sort((a, b) => {
        const columnA = a[sortColumn];
        const columnB = b[sortColumn];
        if (!columnA || !columnB) return 0;
        if (columnA < columnB) return sortDirection === "asc" ? -1 : 1;
        if (columnA > columnB) return sortDirection === "asc" ? 1 : -1;
        return 0;
      });
    return filteredRounds.slice(page * 20, page * 20 + 20);
  }, [searchTerm, sortColumn, sortDirection, page]);
  const handleSort = (column: keyof RoundWithCourse) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const graphData = roundsList
    .map((round) => ({
      roundDate: new Date(round.teeTime).toLocaleDateString(),
      score: round.adjustedGrossScore,
    }))
    .sort((a, b) => {
      return new Date(a.roundDate).getTime() - new Date(b.roundDate).getTime();
    })
    .slice(-21, -1);

  if (!isMounted) return <DashboardSkeleton />;

  return (
    <div className="bg-background text-foreground p-8 rounded-lg h-full">
      <div className="grid grid-cols-1 xl:grid-cols-3">
        <DashboardInfo handicapIndex={profile.handicapIndex} header={header} />
        <DashboardGraphDisplay graphData={graphData} />
      </div>
      {filteredAndSortedRounds.length !== 0 && (
        <div className="bg-card rounded-lg p-6 mt-8">
          <h2 className="text-2xl font-bold mb-4">Rounds History</h2>
          <div className="mb-4" id="table">
            <Input
              type="search"
              placeholder="Search rounds..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(0); // Reset to the first page when the search term changes
              }}
              className="w-full rounded-lg bg-background pl-8"
            />
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead
                  className="cursor-pointer"
                  onClick={() => handleSort("teeTime")}
                >
                  Date{" "}
                  {sortColumn === "teeTime" && (
                    <span className="ml-1">
                      {sortDirection === "asc" ? "\u2191" : "\u2193"}
                    </span>
                  )}
                </TableHead>
                <TableHead
                  className="cursor-pointer"
                  onClick={() => handleSort("courseName")}
                >
                  Course{" "}
                  {sortColumn === "courseName" && (
                    <span className="ml-1">
                      {sortDirection === "asc" ? "\u2191" : "\u2193"}
                    </span>
                  )}
                </TableHead>
                <TableHead
                  className="cursor-pointer"
                  onClick={() => handleSort("adjustedGrossScore")}
                >
                  Score{" "}
                  {sortColumn === "adjustedGrossScore" && (
                    <span className="ml-1">
                      {sortDirection === "asc" ? "\u2191" : "\u2193"}
                    </span>
                  )}
                </TableHead>
                <TableHead
                  className="cursor-pointer"
                  onClick={() => handleSort("parPlayed")}
                >
                  Par{" "}
                  {sortColumn === "parPlayed" && (
                    <span className="ml-1">
                      {sortDirection === "asc" ? "\u2191" : "\u2193"}
                    </span>
                  )}
                </TableHead>
                <TableHead
                  className="cursor-pointer"
                  onClick={() => handleSort("scoreDifferential")}
                >
                  Differential{" "}
                  {sortColumn === "scoreDifferential" && (
                    <span className="ml-1">
                      {sortDirection === "asc" ? "\u2191" : "\u2193"}
                    </span>
                  )}
                </TableHead>
                <TableHead
                  className="cursor-pointer"
                  onClick={() => handleSort("exceptionalScoreAdjustment")}
                >
                  Adjustment{" "}
                  {sortColumn === "exceptionalScoreAdjustment" && (
                    <span className="ml-1">
                      {sortDirection === "asc" ? "\u2191" : "\u2193"}
                    </span>
                  )}
                </TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSortedRounds.map((round, index) => (
                <TableRow key={index}>
                  <TableCell>
                    {new Date(round.teeTime).toLocaleString()}
                  </TableCell>
                  <TableCell>{round.courseName}</TableCell>
                  <TableCell>{round.adjustedGrossScore}</TableCell>
                  <TableCell>{round.parPlayed}</TableCell>
                  <TableCell>
                    {Math.round(round.scoreDifferential * 10) / 10}
                  </TableCell>
                  <TableCell>
                    {round.exceptionalScoreAdjustment
                      ? Math.round(round.exceptionalScoreAdjustment * 10) / 10
                      : 0}
                  </TableCell>
                  <TableCell>
                    <Link href={`/rounds/${round.id}/calculation`}>
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
          {roundsList.length > 20 && (
            <RoundTablePagination
              page={page}
              setPage={setPage}
              roundsList={roundsList}
            />
          )}
        </div>
      )}
    </div>
  );
}
