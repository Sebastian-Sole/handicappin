import GolfScorecard from "@/components/scorecard/golf-scorecard";
import { Large } from "@/components/ui/typography";
import { api } from "@/trpc/server";
import { createServerComponentClient } from "@/utils/supabase/server";
import { P } from "@/components/ui/typography";
import { Suspense } from "react";
import AddRoundSkeleton from "@/components/loading/add-round-skeleton";
import { getComprehensiveUserAccess } from "@/utils/billing/access-control";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { FREE_TIER_ROUND_LIMIT } from "@/utils/billing/constants";

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
        {access.plan === "free" && (
          <div className="w-full max-w-4xl mb-4">
            {access.remainingRounds > 0 ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Free Tier</AlertTitle>
                <AlertDescription>
                  You have <strong>{access.remainingRounds}</strong> of{" "}
                  <strong>{FREE_TIER_ROUND_LIMIT}</strong> free rounds
                  remaining.{" "}
                  <Link href="/upgrade" className="underline">
                    Upgrade to unlimited
                  </Link>
                </AlertDescription>
              </Alert>
            ) : (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Round Limit Reached</AlertTitle>
                <AlertDescription className="flex flex-col gap-2">
                  <p>
                    You&apos;ve used all {FREE_TIER_ROUND_LIMIT} free rounds.
                    Upgrade to continue tracking your golf game!
                  </p>
                  <Link href="/upgrade">
                    <Button variant="default" size="sm">
                      Upgrade Now
                    </Button>
                  </Link>
                </AlertDescription>
              </Alert>
            )}
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
