import Link from "next/link";
import { H4 } from "../ui/typography";
import { Button } from "../ui/button";
import ScoreBarChart from "../charts/score-bar-chart";

interface DashboardGraphDisplayProps {
  graphData: any;
}

const DashboardGraphDisplay = ({ graphData }: DashboardGraphDisplayProps) => {
  return (
    <div className="bg-card rounded-lg p-6 col-span-2 rounded-l-none">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold">Recent Rounds</h2>
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
