"use client";

import Link from "next/link";
import { BarchartChart, LinechartChart } from "./charts";
import { H4 } from "./ui/typography";
import { Button } from "./ui/button";

const HomePageBarChart = ({ previousScores, isPositive }: any) => {
  return (
    <div className="bg-card rounded-lg col-span-2 rounded-l-none w-full h-full pt-8 pr-8">
      {previousScores.length !== 0 && <BarchartChart data={previousScores} />}
      {previousScores.length === 0 && (
        <div className="flex items-center justify-center h-64 xl:h-[90%] border border-gray-100 flex-col">
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

export default HomePageBarChart;
