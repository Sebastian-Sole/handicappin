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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { CartesianGrid, XAxis, Bar, BarChart, Line, LineChart } from "recharts";
import {
  ChartTooltipContent,
  ChartTooltip,
  ChartContainer,
} from "@/components/ui/chart";

interface DashboardProps {
  userId: string;
}

export function Dashboard({ userId }: DashboardProps) {
  console.log(userId);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortColumn, setSortColumn] = useState("date");
  const [sortDirection, setSortDirection] = useState("asc");
  const filteredAndSortedRounds = useMemo(() => {
    return [
      {
        date: "2023-06-15",
        course: "Pebble Beach",
        score: 72,
        par: 70,
        differential: 2.4,
      },
      {
        date: "2023-06-01",
        course: "Torrey Pines",
        score: 75,
        par: 72,
        differential: 3.0,
      },
      {
        date: "2023-05-25",
        course: "Spyglass Hill",
        score: 68,
        par: 68,
        differential: 0.0,
      },
      {
        date: "2023-05-18",
        course: "Pebble Beach",
        score: 71,
        par: 70,
        differential: 1.0,
      },
      {
        date: "2023-05-11",
        course: "Torrey Pines",
        score: 74,
        par: 72,
        differential: 2.0,
      },
    ]
      .filter((round) => {
        return (
          round.date.toLowerCase().includes(searchTerm.toLowerCase()) ||
          round.course.toLowerCase().includes(searchTerm.toLowerCase()) ||
          round.score.toString().includes(searchTerm) ||
          round.par.toString().includes(searchTerm) ||
          round.differential.toString().includes(searchTerm)
        );
      })
      .sort((a, b) => {
        const columnA = a[sortColumn];
        const columnB = b[sortColumn];
        if (columnA < columnB) return sortDirection === "asc" ? -1 : 1;
        if (columnA > columnB) return sortDirection === "asc" ? 1 : -1;
        return 0;
      });
  }, [searchTerm, sortColumn, sortDirection]);
  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };
  return (
    <div className="bg-background text-foreground p-8 rounded-lg shadow-lg">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-card rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold">Recent Rounds</h2>
            <Link
              href={`/dashboard/${userId}/rounds`}
              className="text-primary underline"
              prefetch={false}
            >
              View all rounds
            </Link>
          </div>
          <BarchartChart className="aspect-[16/9]" />
        </div>
        <div className="bg-card rounded-lg p-6">
          <h2 className="text-2xl font-bold mb-4">Handicap</h2>
          <div className="text-6xl font-bold text-primary">12.4</div>
          <p className="text-muted-foreground">Current Handicap</p>
          <div className="mt-4">
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
          </div>
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
                onClick={() => handleSort("date")}
              >
                Date{" "}
                {sortColumn === "date" && (
                  <span className="ml-1">
                    {sortDirection === "asc" ? "\u2191" : "\u2193"}
                  </span>
                )}
              </TableHead>
              <TableHead
                className="cursor-pointer"
                onClick={() => handleSort("course")}
              >
                Course{" "}
                {sortColumn === "course" && (
                  <span className="ml-1">
                    {sortDirection === "asc" ? "\u2191" : "\u2193"}
                  </span>
                )}
              </TableHead>
              <TableHead
                className="cursor-pointer"
                onClick={() => handleSort("score")}
              >
                Score{" "}
                {sortColumn === "score" && (
                  <span className="ml-1">
                    {sortDirection === "asc" ? "\u2191" : "\u2193"}
                  </span>
                )}
              </TableHead>
              <TableHead
                className="cursor-pointer"
                onClick={() => handleSort("par")}
              >
                Par{" "}
                {sortColumn === "par" && (
                  <span className="ml-1">
                    {sortDirection === "asc" ? "\u2191" : "\u2193"}
                  </span>
                )}
              </TableHead>
              <TableHead
                className="cursor-pointer"
                onClick={() => handleSort("differential")}
              >
                Differential{" "}
                {sortColumn === "differential" && (
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
                <TableCell>{round.date}</TableCell>
                <TableCell>{round.course}</TableCell>
                <TableCell>{round.score}</TableCell>
                <TableCell>{round.par}</TableCell>
                <TableCell>{round.differential}</TableCell>
                <TableCell>
                  <Button variant="outline">View</Button>
                  <Button variant="outline">Edit</Button>
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
  return (
    <div {...props}>
      <ChartContainer
        config={{
          desktop: {
            label: "Desktop",
            color: "hsl(var(--chart-1))",
          },
        }}
        className="min-h-[300px]"
      >
        <BarChart
          accessibilityLayer
          data={[
            { month: "January", desktop: 186 },
            { month: "February", desktop: 305 },
            { month: "March", desktop: 237 },
            { month: "April", desktop: 73 },
            { month: "May", desktop: 209 },
            { month: "June", desktop: 214 },
          ]}
        >
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="month"
            tickLine={false}
            tickMargin={10}
            axisLine={false}
            tickFormatter={(value) => value.slice(0, 3)}
          />
          <ChartTooltip
            cursor={false}
            content={<ChartTooltipContent hideLabel />}
          />
          <Bar dataKey="desktop" fill="var(--color-desktop)" radius={8} />
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
            dataKey="month"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tickFormatter={(value) => value.slice(0, 3)}
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
