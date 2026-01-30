import { Statistics } from "@/components/statistics/statistics";
import { api } from "@/trpc/server";
import { Suspense } from "react";
import StatisticsSkeleton from "@/components/statistics/statistics-skeleton";
import { createServerComponentClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";

const StatisticsPage = async () => {
  const supabase = await createServerComponentClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    redirect("/sign-in");
  }

  // Note: Unlimited access check is handled by middleware
  // This page path (/statistics) is listed in UNLIMITED_PATHS, requiring unlimited/lifetime plan

  const [scorecardsResult, profileResult] = await Promise.allSettled([
    api.scorecard.getAllScorecardsByUserId({ userId: data.user.id }),
    api.auth.getProfileFromUserId(data.user.id),
  ]);

  if (scorecardsResult.status === "rejected" || profileResult.status === "rejected") {
    console.error("Error loading statistics:",
      scorecardsResult.status === "rejected" ? scorecardsResult.reason : profileResult.status === "rejected" ? profileResult.reason : "Unknown error"
    );
    return <div>Error loading statistics</div>;
  }

  const scorecards = scorecardsResult.value;
  const profile = profileResult.value;

  return (
    <Suspense fallback={<StatisticsSkeleton />}>
      <Statistics profile={profile} scorecards={scorecards} />
    </Suspense>
  );
};

export default StatisticsPage;
