import { api } from "@/trpc/server";
import { createServerComponentClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import ProfileSkeleton from "@/components/loading/profile-skeleton";
import { getComprehensiveUserAccess } from "@/utils/billing/access-control";
import { TabbedProfilePage } from "@/components/profile/tabbed-profile-page";

const ProfilePage = async (props: { params: Promise<{ id: string }> }) => {
  const params = await props.params;
  const { id: profileId } = params;

  if (!profileId) {
    return <div>Invalid profile id</div>;
  }

  const supabase = await createServerComponentClient();

  const { data, error } = await supabase.auth.getUser();

  if (!data || error) {
    redirect("/login");
  }

  if (data.user.id !== profileId) {
    redirect("/404");
  }

  const profile = await api.auth.getProfileFromUserId(profileId);

  if (!profile) {
    redirect("/404");
  }

  // Fetch billing access data for the billing tab
  const access = await getComprehensiveUserAccess(data.user.id);

  return (
    <Suspense fallback={<ProfileSkeleton />}>
      <TabbedProfilePage
        authUser={data.user}
        profile={profile}
        access={access}
      />
    </Suspense>
  );
};

export default ProfilePage;
