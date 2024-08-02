import { Dashboard } from "@/components/dashboard/dashboard";
import { api } from "@/trpc/server";
import { RoundWithCourse } from "@/types/database";
import { getRandomHeader } from "@/utils/frivolities/headerGenerator";

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

  const roundsList: RoundWithCourse[] = await api.round.getAllByUserId({
    userId: id,
  });
  const profile = await api.auth.getProfileFromUserId(id);

  const header = getRandomHeader();

  return (
    <div>
      <Dashboard profile={profile} roundsList={roundsList} header={header} />
    </div>
  );
};

export default DashboardPage;
