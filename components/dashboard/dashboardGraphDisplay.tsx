import Link from "next/link";
import { H4 } from "../ui/typography";
import { Button } from "../ui/button";
import { BarchartChart } from "../charts";

interface DashboardGraphDisplayProps {
  graphData: any;
}

const DashboardGraphDisplay = ({ graphData }: DashboardGraphDisplayProps) => {
  return (
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
  );
};

export default DashboardGraphDisplay;
