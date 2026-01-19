import { RoundCalculation } from "@/components/round-calculation";
import { api } from "@/trpc/server";
import { createServerComponentClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";

const RoundCalculationPage = async (props: {
  params: Promise<{ id: string }>;
}) => {
  const params = await props.params;
  const { id: roundId } = params;

  if (!roundId) {
    return <div>Invalid round id</div>;
  }

  const supabase = await createServerComponentClient();
  const { data } = await supabase.auth.getUser();
  const userId = data.user?.id;

  if (!userId) {
    redirect("/sign-in");
  }

  const scorecard = await api.scorecard.getScorecardByRoundId({ id: roundId });

  if (!scorecard) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p className="text-muted-foreground">Round not found</p>
      </div>
    );
  }

  if (scorecard.userId !== userId) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p className="text-muted-foreground">This round does not belong to you</p>
      </div>
    );
  }

  return <RoundCalculation scorecard={scorecard} />;
};

export default RoundCalculationPage;
