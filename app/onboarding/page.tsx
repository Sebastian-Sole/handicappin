import { redirect } from "next/navigation";
import { createServerComponentClient } from "@/utils/supabase/server";
import { getComprehensiveUserAccess } from "@/utils/billing/access-control";
import { PlanSelector } from "@/components/billing/plan-selector";

export default async function OnboardingPage() {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Check if user already has access
  const access = await getComprehensiveUserAccess(user.id);

  if (access.hasAccess) {
    // User already has a plan selected
    if (access.hasPremiumAccess) {
      // Paid users go to dashboard
      redirect("/dashboard");
    } else {
      // Free users go to home page
      redirect("/");
    }
  }

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Welcome to Handicappin!</h1>
          <p className="text-lg text-gray-600">
            Choose the plan that&apos;s right for you and start tracking your golf rounds
          </p>
        </div>

        <PlanSelector userId={user.id} />
      </div>
    </div>
  );
}
