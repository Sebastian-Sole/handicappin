import { HomePage } from "@/components/homepage/home-page";
import { api } from "@/trpc/server";
import { createServerComponentClient } from "@/utils/supabase/server";
import { Suspense } from "react";
import HomepageSkeleton from "@/components/loading/homepage-skeleton";
import Landing from "@/components/homepage/landing";

export default async function Home() {
  const supabase = await createServerComponentClient();
  const { data } = await supabase.auth.getUser();

  const userId = data.user?.id;

  if (!userId) {
    return <Landing />;
  }

  const profile = await api.auth.getProfileFromUserId(userId);

  return (
    <Suspense fallback={<HomepageSkeleton />}>
      <HomePage profile={profile} />
    </Suspense>
  );
}
