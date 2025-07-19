import Link from "next/link";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "../ui/card";
import ScoreBarChart from "./score-bar-chart";
import ScoreLegend from "./score-legend";
import { Tables } from "@/types/supabase";
import { Button } from "../ui/button";

interface ScoreBarChartDisplayProps {
  previousScores: {
    roundDate: string;
    score: number;
    influencesHcp?: boolean;
  }[];
  profile: Tables<"profile">;
}

const ScoreBarChartDisplay = ({
  previousScores,
  profile,
}: ScoreBarChartDisplayProps) => {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-4 justify-between w-full">
          <CardTitle className="sm:text-2xl text-xl">Previous Scores</CardTitle>
          <ScoreLegend showLegend={previousScores.length >= 5} />
        </div>
      </CardHeader>
      <CardContent className="p-0 lg:min-h-[300px] justify-center flex items-center">
        {previousScores.length < 5 && (
          <div className="flex justify-center items-center h-full">
            <span className="text-primary">
              Play at least 5 rounds to see your scores
            </span>
          </div>
        )}
        {previousScores.length >= 5 && (
          <div className="w-full h-full pt-8 pr-8">
            <ScoreBarChart scores={previousScores} />
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

export default ScoreBarChartDisplay;
