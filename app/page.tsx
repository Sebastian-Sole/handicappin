import { HomePage } from "@/components/homepage/home-page";
import { api } from "@/trpc/server";
import { createServerComponentClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import HomepageSkeleton from "@/components/loading/homepage-skeleton";

export default async function Home() {
  const supabase = createServerComponentClient();
  const { data } = await supabase.auth.getUser();

  const userId = data.user?.id;

  if (!userId) {
    redirect("/login");
  }

  const profile = await api.auth.getProfileFromUserId(userId);

  return (
    <Suspense fallback={<HomepageSkeleton />}>
      <HomePage profile={profile} />
    </Suspense>
  );
}
