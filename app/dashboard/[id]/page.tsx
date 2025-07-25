import { Dashboard } from "@/components/dashboard/dashboard";
import { api } from "@/trpc/server";
import { getRandomHeader } from "@/utils/frivolities/headerGenerator";
import { Suspense } from "react";
import DashboardSkeleton from "@/components/dashboard/dashboardSkeleton";

import { createServerComponentClient } from "@/utils/supabase/server";

const DashboardPage = async ({ params }: { params: { id: string } }) => {
  const { id } = params;

  if (!id) {
    return <div>Invalid user id</div>;
  }

  const supabase = createServerComponentClient();
  const { data } = await supabase.auth.getUser();

  if (!data) {
    return <div>Invalid user</div>;
  }
  if (data.user?.id !== id) {
    return <div>Invalid user, this is not your profile</div>;
  }

  try {
    const scorecards = await api.scorecard.getAllScorecardsByUserId({
      userId: id,
    });
    const profile = await api.auth.getProfileFromUserId(id);
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
  } catch (error) {
    console.error(error);
    return <div>Error loading scorecards</div>;
  }
};

export default DashboardPage;
