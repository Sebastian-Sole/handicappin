import { redirect } from "next/navigation";
import { createServerComponentClient } from "@/utils/supabase/server";

export default async function BillingPage() {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Redirect to profile page billing tab
  redirect(`/profile/${user.id}?tab=billing`);
}
