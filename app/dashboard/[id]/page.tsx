import { Dashboard } from "@/components/dashboard";
import { api } from "@/trpc/server";
import { RoundWithCourse } from "@/types/database";
import { Database, Tables } from "@/types/supabase";

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

  const roundsList: RoundWithCourse[] = await api.round.getAllByUserId(id);
  const profile = await api.auth.getProfileFromUserId(id);

  return (
    <div>
      <Dashboard profile={profile} roundsList={roundsList} />
    </div>
  );
};

export default DashboardPage;
