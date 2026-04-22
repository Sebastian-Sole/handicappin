import React from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "../ui/card";
import HandicapTrendChart from "./handicap-trend-chart";
import { Tables } from "@/types/supabase";
import { Button } from "../ui/button";
import { StatDelta } from "@/components/ui/stat-delta";
import Link from "next/link";

interface HandicapTrendChartDisplayProps {
  previousHandicaps: {
    key: string;
    roundDate: string;
    roundTime: string;
    handicap: number;
  }[];
  handicapIndex: number;
  percentageChange: number;
  profile: Tables<"profile">;
}

const HandicapTrendChartDisplay = ({
  previousHandicaps,
  percentageChange,
  handicapIndex,
  profile,
}: HandicapTrendChartDisplayProps) => {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-sm">
        <React.Fragment>
          <CardTitle className="sm:text-2xl text-xl min-[400px]:hidden">
            HCP Trend
          </CardTitle>
          <CardTitle className="sm:text-2xl text-xl min-[400px]:block hidden">
            Handicap Trend
          </CardTitle>
        </React.Fragment>
        <div className="flex items-center space-x-sm">
          <span className="sm:text-2xl text-figure-sm">{handicapIndex}</span>
          {/* TODO: Conditionally render only if more than 5 rounds */}
          <div className="min-[340px]:block hidden">
            <StatDelta
              value={percentageChange}
              invert
              format={(v) => `${v > 0 ? "+" : ""}${v}%`}
              className="text-sm"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0 lg:min-h-[300px] flex justify-center items-center">
        {previousHandicaps.length < 5 && (
          <div className="flex justify-center items-center h-full">
            <span className="text-primary">
              Play at least 5 rounds to see your scores
            </span>
          </div>
        )}
        {previousHandicaps.length >= 5 && (
          <div className="w-full h-full pt-xl pr-xl">
            <HandicapTrendChart
              previousHandicaps={previousHandicaps}
              isPositive={percentageChange > 0}
            />
          </div>
        )}
      </CardContent>
      <CardFooter className="pt-md flex justify-center">
        <Link href={`/dashboard/${profile.id}`}>
          <Button variant={"link"}>View stats</Button>
        </Link>
      </CardFooter>
    </Card>
  );
};

export default HandicapTrendChartDisplay;
