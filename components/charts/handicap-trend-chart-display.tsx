import { ArrowDown, ArrowUp } from "lucide-react";
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
import Link from "next/link";

interface HandicapTrendChartDisplayProps {
  previousHandicaps: {
    roundDate: string;
    handicap: number;
  }[];
  handicapIndex: number;
  percentageChange: number;
  profile: Tables<"Profile">;
}

const HandicapTrendChartDisplay = ({
  previousHandicaps,
  percentageChange,
  handicapIndex,
  profile,
}: HandicapTrendChartDisplayProps) => {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <React.Fragment>
          <CardTitle className="sm:text-2xl text-xl min-[400px]:hidden">
            HCP Trend
          </CardTitle>
          <CardTitle className="sm:text-2xl text-xl min-[400px]:block hidden">
            Handicap Trend
          </CardTitle>
        </React.Fragment>
        <div className="flex items-center space-x-2">
          <span className="sm:text-2xl text-xl font-bold">{handicapIndex}</span>
          <div className="min-[340px]:block hidden">
            {percentageChange < 0 && (
              <span className="flex items-center text-sm text-green-500">
                <ArrowDown className="h-4 w-4 mr-1" />
                {percentageChange}%
              </span>
            )}
            {percentageChange > 0 && (
              <span className="flex items-center text-sm text-red-500">
                <ArrowUp className="h-4 w-4 mr-1" />+{percentageChange}%
              </span>
            )}
            {percentageChange === 0 && (
              <span className="flex items-center text-sm text-gray-500">
                +{percentageChange}%
              </span>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0 lg:min-h-[300px] flex justify-center items-center">
        {previousHandicaps.length <= 5 && (
          <div className="flex justify-center items-center h-full">
            <span className="text-primary">
              Play at least 5 rounds to see your scores
            </span>
          </div>
        )}
        {previousHandicaps.length > 5 && (
          <div className="w-full h-full pt-8 pr-8">
            <HandicapTrendChart
              previousHandicaps={previousHandicaps}
              isPositive={percentageChange > 0}
            />
          </div>
        )}
      </CardContent>
      <CardFooter className="pt-4 flex justify-center">
        <Link href={`/stats/${profile.id}`}>
          <Button variant={"link"}>View stats</Button>
        </Link>
      </CardFooter>
    </Card>
  );
};

export default HandicapTrendChartDisplay;
