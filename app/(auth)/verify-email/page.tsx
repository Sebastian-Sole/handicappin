import { createServerComponentClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { logger } from "@/lib/logging";

const VerifyLoginPage = async (props: {
  searchParams: Promise<{ code?: string }>;
}) => {
  const searchParams = await props.searchParams;
  const supabase = await createServerComponentClient();

  const { code } = searchParams;

  if (!code) {
    redirect("/login");
  }

  // Exchange the code for a session
  const { data: exchangeData, error: exchangeError } =
    await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) {
    logger.error("Error exchanging code for session", {
      error: exchangeError.message,
    });
    redirect("/login");
  }

  if (!exchangeData) {
    logger.error("No data returned from exchangeCodeForSession");
    redirect("/login");
  }

  if (exchangeData.session) {
    // TODO: Session not being set, supabase bug?
  }

  const user = exchangeData?.user;
  if (user) {
    // Check if the profile exists
    const { error: profileError } = await supabase
      .from("profile")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      logger.error("Error fetching profile", { error: profileError.message });
      redirect("/login");
    }

    const { error: updateProfileError } = await supabase
      .from("profile")
      .update({
        verified: true,
      })
      .eq("id", user.id);

    if (updateProfileError) {
      logger.error("Error updating profile", {
        error: updateProfileError.message,
      });
      redirect("/login");
    }

    redirect(`/login?verified=true`);
  }

  return <div>Failed to verify email, try again</div>;
};

export default VerifyLoginPage;
