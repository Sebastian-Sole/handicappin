import GolfScorecard from "@/components/scorecard/golf-scorecard";
import { Large } from "@/components/ui/typography";
import { api } from "@/trpc/server";
import { createServerComponentClient } from "@/utils/supabase/server";

const AddRoundPage = async () => {
  const supabase = createServerComponentClient();
  const { data } = await supabase.auth.getUser();

  const userId = data.user?.id;

  if (!userId) {
    return <div>Invalid user</div>;
  }

  const profile = await api.auth.getProfileFromUserId(userId);

  return (
    <div className="flex justify-center items-center flex-col h-full py-8">
      <Large className="text-4xl text-primary mb-8">Add Round</Large>
      <p className="text-sm text-muted-foreground mb-8">
        Fill out the scorecard to register your round.
      </p>
      <GolfScorecard profile={profile} />
    </div>
  );
};

export default AddRoundPage;
