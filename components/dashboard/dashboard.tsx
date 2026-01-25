"use client";

import DashboardInfo from "./dashboardInfo";
import DashboardGraphDisplay from "./dashboardGraphDisplay";
import useMounted from "@/hooks/useMounted";
import { Tables } from "@/types/supabase";
import DashboardSkeleton from "./dashboardSkeleton";
import { getRelevantRounds } from "@/lib/handicap";
import { ScorecardWithRound } from "@/types/scorecard-input";
import { RoundsTable } from "./roundsTable";

interface DashboardProps {
  profile: Tables<"profile">;
  scorecards: ScorecardWithRound[];
  header: string;
}

export function Dashboard({ profile, scorecards, header }: DashboardProps) {
  const isMounted = useMounted();

  // Sort scorecards by teeTime before mapping (matches homepage behavior)
  // Use round.id as secondary sort for stable ordering when teeTimes are identical
  const sortedScorecards = [...scorecards].sort((a, b) => {
    const timeComparison = new Date(a.teeTime).getTime() - new Date(b.teeTime).getTime();
    if (timeComparison !== 0) return timeComparison;
    // If teeTimes are equal, sort by round ID
    return a.round.id - b.round.id;
  });

  // Take last 20 rounds for handicap calculation (matches homepage)
  const last20Scorecards =
    sortedScorecards.length > 20
      ? sortedScorecards.slice(-20)
      : sortedScorecards;

  // Calculate relevant rounds from last 20 (matches homepage behavior)
  const relevantRoundsList = getRelevantRounds(
    last20Scorecards.map((scorecard) => scorecard.round)
  );

  // Take last 10 rounds for display
  const recentScorecards =
    sortedScorecards.length > 10
      ? sortedScorecards.slice(-10)
      : sortedScorecards;

  // Map to graph data
  const graphData = recentScorecards.map((scorecard) => ({
    key: `${scorecard.round.id}`, // Unique key for recharts
    roundDate: new Date(scorecard.teeTime).toLocaleDateString(),
    roundTime: new Date(scorecard.teeTime).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }),
    score: scorecard.round.scoreDifferential,
    influencesHcp: relevantRoundsList.includes(scorecard.round),
  }));

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
