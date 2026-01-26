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

  // Note: Premium access check is handled by middleware
  // This page path (/statistics) is listed in PREMIUM_PATHS

  try {
    const scorecards = await api.scorecard.getAllScorecardsByUserId({
      userId: data.user.id,
    });
    const profile = await api.auth.getProfileFromUserId(data.user.id);

    return (
      <Suspense fallback={<StatisticsSkeleton />}>
        <Statistics profile={profile} scorecards={scorecards} />
      </Suspense>
    );
  } catch (error) {
    console.error(error);
    return <div>Error loading statistics</div>;
  }
};

export default StatisticsPage;
