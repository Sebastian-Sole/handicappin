import { HomePage } from "@/components/home-page";
import { api } from "@/trpc/server";
import { createServerComponentClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";

export default async function Home() {
  const supabase = createServerComponentClient();
  const { data } = await supabase.auth.getUser();

  const userId = data.user?.id;

  if (!userId) {
    redirect("/login");
  }

  const profile = await api.auth.getProfileFromUserId(userId);

  return <HomePage profile={profile} />;
}
