import { createServerComponentClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";

const VerifyLoginPage = async ({
  searchParams,
}: {
  searchParams: { code?: string };
}) => {
  const supabase = createServerComponentClient();

  const { code } = searchParams;
  console.log(code);
  if (!code) {
    redirect("/login");
  }

  // Exchange the code for a session
  const { data: exchangeData, error: exchangeError } =
    await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) {
    console.error("Error exchanging code for session:", exchangeError.message);
    redirect("/login");
  }

  console.log("Code exchanged for session");

  if (exchangeData.session) {
    const { error: setSessionError } = await supabase.auth.setSession(
      exchangeData.session
    );
    if (setSessionError) {
      console.error("Error setting session:", setSessionError.message);
      redirect("/login");
    }
  }

  console.log("Session set");

  // Get the logged-in user
  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData?.session?.user;

  console.log("--------USER--------");
  console.log(user);
  console.log("--------USER--------");

  if (user) {
    // Check if the profile exists
    const { data: profileData, error: profileError } = await supabase
      .from("Profile")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    console.log("--------PROFILE--------");
    console.log(profileData);
    console.log("--------PROFILE--------");

    if (profileError) {
      console.error("Error fetching profile:", profileError.message);
      redirect("/login");
    }

    const { error: updateProfileError } = await supabase
      .from("Profile")
      .update({
        verified: true,
      })
      .eq("id", user.id);

    if (updateProfileError) {
      console.error("Error updating profile:", updateProfileError.message);
      redirect("/login");
    }

    // Redirect to dashboard or homepage
    console.log("Success, redirecting to homepage");
    redirect("/");
  }

  // If session is invalid, redirect to login
  redirect("/login");
};

export default VerifyLoginPage;
