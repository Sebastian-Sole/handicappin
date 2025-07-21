"use client";

import DashboardInfo from "./dashboardInfo";
import DashboardGraphDisplay from "./dashboardGraphDisplay";
import useMounted from "@/hooks/useMounted";
import { Tables } from "@/types/supabase";
import DashboardSkeleton from "./dashboardSkeleton";
import { getRelevantRounds } from "@/utils/calculations/handicap";
import { ScorecardWithRound } from "@/types/scorecard";
import { RoundsTable } from "./roundsTable";

interface DashboardProps {
  profile: Tables<"profile">;
  scorecards: ScorecardWithRound[];
  header: string;
}

export function Dashboard({ profile, scorecards, header }: DashboardProps) {
  const isMounted = useMounted();

  const relevantRoundsList = getRelevantRounds(
    scorecards.map((scorecard) => scorecard.round)
  );

  const sortedGraphData = scorecards
    .map((scorecard) => ({
      roundDate: new Date(scorecard.teeTime).toLocaleDateString(),
      score: scorecard.round.adjustedGrossScore,
      influencesHcp: relevantRoundsList.includes(scorecard.round),
    }))
    .sort((a, b) => {
      return new Date(a.roundDate).getTime() - new Date(b.roundDate).getTime();
    });

  const graphData =
    sortedGraphData.length >= 21
      ? sortedGraphData.slice(-21, -1)
      : sortedGraphData;

  if (!isMounted) return <DashboardSkeleton />;

  return (
    <div className="bg-background text-foreground p-8 rounded-lg h-full">
      <div className="grid grid-cols-1 2xl:grid-cols-3">
        <DashboardInfo handicapIndex={profile.handicapIndex} header={header} />
        <DashboardGraphDisplay graphData={graphData} />
      </div>

      <div className="mt-8">
        <RoundsTable scorecards={scorecards} />
      </div>
    </div>
  );
}
