import ForgotPasswordForm from "@/components/auth/forgot-password-form";
import { createServerComponentClient } from "@/utils/supabase/server";

export default async function ForgotPasswordPage() {
  const supabase = await createServerComponentClient();

  // Fetch user's email if they're logged in
  const { data: { user } } = await supabase.auth.getUser();
  const userEmail = user?.email;

  return <ForgotPasswordForm initialEmail={userEmail} />;
}
