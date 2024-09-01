import { HomePage } from "@/components/home-page";
import { api } from "@/trpc/server";
import { createServerComponentClient } from "@/utils/supabase/server";

export default async function Home() {
  const supabase = createServerComponentClient();
  const { data } = await supabase.auth.getUser();

  const userId = data.user?.id;

  if (!userId) {
    return <div>Invalid user</div>;
  }

  const profile = await api.auth.getProfileFromUserId(userId);

  return <HomePage profile={profile} />;
}
