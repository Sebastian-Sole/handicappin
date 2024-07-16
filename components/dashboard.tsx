"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectGroup,
  SelectItem,
} from "@/components/ui/select";
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

interface DashboardProps {
  profile: Tables<"Profile">;
  roundsList: RoundWithCourse[];
}

export function Dashboard({ profile, roundsList }: DashboardProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortColumn, setSortColumn] =
    useState<keyof RoundWithCourse>("teeTime");
  const [sortDirection, setSortDirection] = useState("asc");

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

  console.log(graphData);

  return (
    <div className="bg-background text-foreground p-8 rounded-lg shadow-lg">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-card rounded-lg p-6">
          <h2 className="text-2xl font-bold mb-4">Handicap</h2>
          <div className="text-6xl font-bold text-primary">
            {profile.handicapIndex}
          </div>
          <p className="text-muted-foreground">Current Handicap</p>
          {/* <div className="mt-4">
            <Select>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select Course" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="pebble-beach">Pebble Beach</SelectItem>
                  <SelectItem value="torrey-pines">Torrey Pines</SelectItem>
                  <SelectItem value="spyglass-hill">Spyglass Hill</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
            <div className="mt-2">
              <p>Course Handicap: 14</p>
              <p>Playing Handicap: 12</p>
              <Button variant="link" className="text-primary underline">
                How is my handicap calculated?
              </Button>
            </div>
          </div> */}
        </div>
        <div className="bg-card rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold">Recent Rounds</h2>
            <Link
              href={`/dashboard/${profile.id}/rounds`}
              className="text-primary underline"
              prefetch={false}
            >
              View all rounds
            </Link>
          </div>
          <BarchartChart className="aspect-[16/9]" data={graphData} />
        </div>
      </div>
      <div className="bg-card rounded-lg p-6 mt-8">
        <h2 className="text-2xl font-bold mb-4">Rounds History</h2>
        <div className="mb-4">
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
                <TableCell>{round.scoreDifferential}</TableCell>
                <TableCell>
                  <Link href={`/rounds/${round.id}/calculation`}>
                    View Calculation
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
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
            tickFormatter={(value) => value.slice(0, 4)}
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
            tickFormatter={(value) => value.slice(0, 5)}
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
