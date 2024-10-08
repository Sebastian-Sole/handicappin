import AddRoundForm from "@/components/round/addRoundForm";
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
      <AddRoundForm profile={profile} />
    </div>
  );
};

export default AddRoundPage;
