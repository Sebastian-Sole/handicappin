import { redirect } from "next/navigation";
import { createServerComponentClient } from "@/utils/supabase/server";
import { PlanSelector } from "@/components/billing/plan-selector";
import { getBillingFromJWT } from "@/utils/supabase/jwt";
import { logger } from "@/lib/logging";
import { H1 } from "@/components/ui/typography";

export default async function OnboardingPage() {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Check if user already has access by reading JWT claims (consistent with middleware)
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Decode JWT to get custom claims (session.user.app_metadata doesn't include them)
  // SECURITY: Safe to use for routing - JWT signature already verified by getSession()
  // See getBillingFromJWT() for full security documentation
  const billing = getBillingFromJWT(session);

  // If user has a plan in JWT, redirect to billing (they've completed onboarding)
  if (billing?.plan) {
    redirect("/billing");
  }

  // If JWT billing claims are missing, this is expected for new users who haven't selected a plan yet
  logger.info("Onboarding: No plan in JWT, showing plan selection", {
    billing: billing ?? undefined,
  });

  // If no access, show onboarding
  return (
    <div className="container mx-auto px-md py-3xl">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-2xl">
          <H1 className="mb-md">Welcome to Handicappin!</H1>
          <p className="text-lg text-muted-foreground">
            Choose the plan that&apos;s right for you and start tracking your
            golf rounds
          </p>
        </div>

        <PlanSelector userId={user.id} mode="onboarding" />
      </div>
    </div>
  );
}
