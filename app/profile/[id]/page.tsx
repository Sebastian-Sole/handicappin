import UserProfile from "@/components/profile/user-profile";
import { toast } from "@/components/ui/use-toast";
import { api } from "@/trpc/server";
import { createServerComponentClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";

const ProfilePage = async ({ params }: { params: { id: string } }) => {
  const { id: profileId } = params;

  if (!profileId) {
    return <div>Invalid profile id</div>;
  }

  const supabase = createServerComponentClient();

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

  return <UserProfile authUser={data.user} profile={profile} />;
};

export default ProfilePage;
