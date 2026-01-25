import { RoundCalculation } from "@/components/round-calculation";
import { api } from "@/trpc/server";
import { createServerComponentClient } from "@/utils/supabase/server";
import { notFound, redirect } from "next/navigation";

const RoundCalculationPage = async (props: {
  params: Promise<{ id: string }>;
}) => {
  const params = await props.params;
  const { id: roundId } = params;

  if (!roundId) {
    notFound();
  }

  const supabase = await createServerComponentClient();
  const { data } = await supabase.auth.getUser();
  const userId = data.user?.id;

  if (!userId) {
    redirect("/sign-in");
  }

  const scorecard = await api.scorecard.getScorecardByRoundId({ id: roundId });

  if (!scorecard || scorecard.userId !== userId) {
    notFound();
  }

  return <RoundCalculation scorecard={scorecard} />;
};

export default RoundCalculationPage;
