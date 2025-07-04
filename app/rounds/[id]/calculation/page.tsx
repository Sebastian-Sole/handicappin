import { RoundCalculation } from "@/components/round-calculation";
import { api } from "@/trpc/server";
import { createServerComponentClient } from "@/utils/supabase/server";

const RoundCalculationPage = async ({ params }: { params: { id: string } }) => {
  const { id: roundId } = params;

  if (!roundId) {
    return <div>Invalid round id</div>;
  }

  const supabase = createServerComponentClient();

  const { data } = await supabase.auth.getUser();

  const userId = data.user?.id;

  if (!userId) {
    return <div>Invalid user</div>;
  }

  const round = await api.round.getRoundById({ roundId });

  if (!round) {
    return <div> Round not found </div>;
  }

  // Todo: Test this logic
  if (round.userId !== userId) {
    return <div> This round does not belong to you </div>;
  }

  // Get holes for the round
  const holes = await api.hole.getHolesForRound(roundId);

  return (
    <div>
      <RoundCalculation round={round} holes={holes} />
    </div>
  );
};

export default RoundCalculationPage;
