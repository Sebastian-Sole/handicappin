import GolfScorecard from "@/components/scorecard/golf-scorecard";
import { Large } from "@/components/ui/typography";
import { api } from "@/trpc/server";
import { createServerComponentClient } from "@/utils/supabase/server";
import { P } from "@/components/ui/typography";
import { Suspense } from "react";
import AddRoundSkeleton from "@/components/loading/add-round-skeleton";
import { getComprehensiveUserAccess } from "@/utils/billing/access-control";
import {
  FREE_TIER_ROUND_LIMIT,
  FREE_TIER_ROUND_LIMIT_CRITICAL,
  FREE_TIER_ROUND_LIMIT_WARNING,
} from "@/utils/billing/constants";
import {
  UsageLimitAlert,
  UsageLimitReachedView,
} from "@/components/scorecard/usage-limit-alert";

const AddRoundPage = async () => {
  const supabase = await createServerComponentClient();
  const { data } = await supabase.auth.getUser();

  const userId = data.user?.id;

  if (!userId) {
    return <div>Invalid user</div>;
  }

  const profile = await api.auth.getProfileFromUserId(userId);

  // Get user access info to show remaining rounds
  const access = await getComprehensiveUserAccess(userId);

  const alertVariant =
    access.remainingRounds < FREE_TIER_ROUND_LIMIT_CRITICAL
      ? "critical"
      : access.remainingRounds < FREE_TIER_ROUND_LIMIT_WARNING
      ? "warning"
      : "default";

  // If user has no remaining rounds, only show the limit reached view
  if (access.plan === "free" && access.remainingRounds <= 0) {
    return (
      <Suspense fallback={<AddRoundSkeleton />}>
        <div className="flex justify-center items-center flex-col">
          <UsageLimitReachedView />
        </div>
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<AddRoundSkeleton />}>
      <div className="flex justify-center items-center flex-col h-full py-2 md:py-4 lg:py-8">
        <Large className="text-4xl text-primary mb-2 md:mb-4 lg:mb-8">
          Add Round
        </Large>
        <P className="text-sm text-muted-foreground !mt-0 mb-2">
          Fill out the scorecard to register your round.
        </P>

        {/* Show remaining rounds for free tier users */}
        {access.plan === "free" && access.remainingRounds > 0 && (
          <div className="w-full max-w-4xl mb-4">
            <UsageLimitAlert
              current={FREE_TIER_ROUND_LIMIT - access.remainingRounds}
              total={FREE_TIER_ROUND_LIMIT}
              variant={alertVariant}
            />
          </div>
        )}

        <GolfScorecard
          profile={profile}
          access={access}
          isAtLimit={access.plan === "free" && access.remainingRounds <= 0}
        />
      </div>
    </Suspense>
  );
};

export default AddRoundPage;
