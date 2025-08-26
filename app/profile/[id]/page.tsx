import UserProfile from "@/components/profile/user-profile";
import { toast } from "@/components/ui/use-toast";
import { api } from "@/trpc/server";
import { createServerComponentClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import ProfileSkeleton from "@/components/loading/profile-skeleton";

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
    // TODO: Is this the correct instantiation of the toast?
    toast({
      title: "Unauthorized",
      description: "You do not have permission to view this profile",
      variant: "destructive",
    });
    redirect("/404");
  }

  const profile = await api.auth.getProfileFromUserId(profileId);

  if (!profile) {
    redirect("/404");
  }

  return (
    <Suspense fallback={<ProfileSkeleton />}>
      <UserProfile authUser={data.user} profile={profile} />
    </Suspense>
  );
};

export default ProfilePage;
