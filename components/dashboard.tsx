"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import {
  CartesianGrid,
  XAxis,
  Bar,
  BarChart,
  Line,
  LineChart,
  YAxis,
} from "recharts";
import {
  ChartTooltipContent,
  ChartTooltip,
  ChartContainer,
} from "@/components/ui/chart";
import { RoundWithCourse } from "@/types/database";
import { Tables } from "@/types/supabase";
import { Button } from "./ui/button";
import { H4, P } from "./ui/typography";
import useMounted from "@/hooks/useMounted";
import { Skeleton } from "./ui/skeleton";
import DashboardSkeleton from "./skeletons/DashboardSkeleton";

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

  const filteredAndSortedRounds = useMemo(() => {
    return roundsList
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
  }, [searchTerm, sortColumn, sortDirection]);
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
    });

  if (!isMounted) return <DashboardSkeleton />;

  return (
    <div className="bg-background text-foreground p-8 rounded-lg h-full">
      <div className="grid grid-cols-1 xl:grid-cols-3">
        <div className="bg-card rounded-lg p-6">
          <h2 className="text-2xl font-bold mb-4">Handicap</h2>
          <div className="text-6xl font-bold text-primary">
            {profile.handicapIndex}
          </div>
          <p className="text-muted-foreground">Current Handicap</p>
          <div className="mt-0">
            {/* Todo: Implement link */}
            <Button
              variant="link"
              className="text-primary underline px-0 mb-10"
            >
              How is my handicap calculated?{" "}
            </Button>
            <H4 className="!mb-2">{header}</H4>
            <P className="!mt-4">
              Handicappin&apos; believes in transparency and making golf
              accessible. It can be difficult to find accurate and consistent
              information on the calculations of scores, handicaps and the rules
              of golf online. We aim to be a reliable source of information and
              aim to ease the unnecessary confusion around golf.
            </P>
            <P>
              An easy, interactive way to understand the calculations behind
              handicaps and scoring can be viewed by clicking the button below,
              or by viewing a specific round&apos;s calculation.
            </P>
            {/* Todo: Implement link */}
            <Button variant="link" className="text-primary underline px-0 mb-6">
              Click here to learn more
            </Button>
          </div>
        </div>
        <div className="bg-card rounded-lg p-6 col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold">Recent Rounds</h2>
            <Link
              href={`/rounds/add`}
              className="text-primary underline"
              prefetch={false}
            >
              Add a round
            </Link>
          </div>
          {graphData.length !== 0 && (
            <BarchartChart className="aspect-[16/9]" data={graphData} />
          )}
          {graphData.length === 0 && (
            <div className="flex items-center justify-center h-full border border-gray-100 flex-col">
              <H4>No rounds found</H4>
              <Link
                href={`/rounds/add`}
                className="text-primary underline mt-4"
                prefetch={false}
              >
                <Button variant={"secondary"}>Add a round here</Button>
              </Link>
            </div>
          )}
        </div>
      </div>
      {filteredAndSortedRounds.length !== 0 && (
        <div className="bg-card rounded-lg p-6 mt-8">
          <h2 className="text-2xl font-bold mb-4">Rounds History</h2>
          <div className="mb-4" id="table">
            <Input
              type="search"
              placeholder="Search rounds..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
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
        </div>
      )}
    </div>
  );
}

function BarchartChart(props: any) {
  const { data } = props;
  return (
    <div {...props}>
      <ChartContainer
        config={{
          desktop: {
            label: "Desktop",
            color: "hsl(var(--chart-1))",
          },
        }}
        className="min-h-full"
      >
        <BarChart accessibilityLayer data={data}>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="roundDate"
            tickLine={false}
            tickMargin={8}
            axisLine={false}
            tickFormatter={(value) => {
              const dateParts = value.split(/[-\/.\s]/);
              return `${dateParts[0]}/${dateParts[1]}`;
            }}
          />
          <ChartTooltip
            cursor={false}
            content={<ChartTooltipContent hideLabel />}
          />
          <YAxis
            dataKey="score"
            tickLine={false}
            tickMargin={8}
            axisLine={false}
          ></YAxis>
          <Bar dataKey="score" fill="var(--color-desktop)" radius={8} />
        </BarChart>
      </ChartContainer>
    </div>
  );
}

function LinechartChart(props: any) {
  return (
    <div {...props}>
      <ChartContainer
        config={{
          desktop: {
            label: "Desktop",
            color: "hsl(var(--chart-1))",
          },
        }}
      >
        <LineChart
          accessibilityLayer
          data={[
            { month: "January", desktop: 186 },
            { month: "February", desktop: 305 },
            { month: "March", desktop: 237 },
            { month: "April", desktop: 73 },
            { month: "May", desktop: 209 },
            { month: "June", desktop: 214 },
          ]}
          margin={{
            left: 12,
            right: 12,
          }}
        >
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="roundDate"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tickFormatter={(value) => {
              const dateParts = value.split(/[-\/.\s]/);
              return `${dateParts[0]}/${dateParts[1]}`;
            }}
          />
          <ChartTooltip
            cursor={false}
            content={<ChartTooltipContent hideLabel />}
          />
          <Line
            dataKey="desktop"
            type="natural"
            stroke="var(--color-desktop)"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ChartContainer>
    </div>
  );
}
