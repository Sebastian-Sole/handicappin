"use client";

import Link from "next/link";
import { BarchartChart, LinechartChart } from "./charts";
import { H4 } from "./ui/typography";
import { Button } from "./ui/button";

const HomePageLineGraph = ({ previousHandicaps, isPositive }: any) => {
  return (
    <div className="bg-card rounded-lg col-span-2 rounded-l-none w-full h-full pt-8 pr-8">
      {previousHandicaps.length !== 0 && (
        <LinechartChart
          className="aspect-[16/9]"
          data={previousHandicaps}
          isPositive={isPositive}
        />
      )}
      {previousHandicaps.length === 0 && (
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

export default HomePageLineGraph;
