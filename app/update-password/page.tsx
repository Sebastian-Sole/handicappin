import UpdatePassword from "@/components/profile/update-password";
import { createServerComponentClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";

const UpdatePasswordPage = async ({
  searchParams,
}: {
  searchParams: { token?: string };
}) => {
  const supabase = createServerComponentClient();

  const token = searchParams.token;
  if (!token) {
    redirect("/forgot-password");
  }

  // Get user from token
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/forgot-password");
  }

  const email = user?.email;

  if (!email) {
    redirect("/forgot-password");
  }

  return <UpdatePassword token={token} email={email} />;
};

export default UpdatePasswordPage;
