import { Dashboard } from "@/components/dashboard/dashboard";
import { api } from "@/trpc/server";
import { getRandomHeader } from "@/utils/frivolities/headerGenerator";
import { Suspense } from "react";
import DashboardSkeleton from "@/components/dashboard/dashboardSkeleton";

import { createServerComponentClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";

const DashboardPage = async (props: { params: Promise<{ id: string }> }) => {
  const params = await props.params;
  const { id } = params;

  if (!id) {
    return <div>Invalid user id</div>;
  }

  const supabase = await createServerComponentClient();
  const { data } = await supabase.auth.getUser();

  if (!data) {
    return <div>Invalid user</div>;
  }
  if (data.user?.id !== id) {
    return <div>Invalid user, this is not your profile</div>;
  }

  // Note: Unlimited access check is handled by middleware
  // This page path (/dashboard/*) is listed in UNLIMITED_PATHS, so middleware redirects users without unlimited/lifetime plan

  const [scorecardsResult, profileResult] = await Promise.allSettled([
    api.scorecard.getAllScorecardsByUserId({ userId: id }),
    api.auth.getProfileFromUserId(id),
  ]);

  if (scorecardsResult.status === "rejected" || profileResult.status === "rejected") {
    console.error("Error loading dashboard data:",
      scorecardsResult.status === "rejected" ? scorecardsResult.reason : profileResult.status === "rejected" ? profileResult.reason : "Unknown error"
    );
    return <div>Error loading scorecards</div>;
  }

  const scorecards = scorecardsResult.value;
  const profile = profileResult.value;
  const header = getRandomHeader();

  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <div>
        <Dashboard
          profile={profile}
          scorecards={scorecards}
          header={header}
        />
      </div>
    </Suspense>
  );
};

export default DashboardPage;
