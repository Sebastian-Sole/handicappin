import Link from "next/link";
import { Button } from "../ui/button";
import ScoreBarChart from "../charts/score-bar-chart";
import { H2 } from "../ui/typography";

interface ScoreGraphDataPoint {
  key: string;
  roundDate: string;
  roundTime: string;
  score: number;
  influencesHcp: boolean;
}

interface DashboardGraphDisplayProps {
  graphData: ScoreGraphDataPoint[];
}

const DashboardGraphDisplay = ({ graphData }: DashboardGraphDisplayProps) => {
  return (
    <div className="bg-card rounded-lg p-6 col-span-2 rounded-l-none 2xl:min-h-auto xl:min-h-[450px] min-h-64">
      <div className="flex items-center justify-between mb-4">
        <H2>Recent Rounds</H2>
        <Link href={`/rounds/add`} prefetch={false}>
          <Button variant={"link"} className="underline">
            Add a round
          </Button>
        </Link>
      </div>
      <ScoreBarChart scores={graphData} className="hidden sm:block" />
    </div>
  );
};

export default DashboardGraphDisplay;
