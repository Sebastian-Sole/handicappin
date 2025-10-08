import { redirect } from "next/navigation";
import { createServerComponentClient } from "@/utils/supabase/server";

export default async function BillingSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Wait a moment for webhook to process (optional)
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Redirect to billing page with success message
  redirect(`/billing?session_id=${params.session_id}`);
}
