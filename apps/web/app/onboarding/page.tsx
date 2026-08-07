import { redirect } from "next/navigation";
import { createServerComponentClient } from "@/utils/supabase/server";
import { PlanSelector } from "@/components/billing/plan-selector";
import { getBillingFromJWT } from "@/utils/supabase/jwt";
import { hasSelectedPlan, safeInternalPath } from "@/lib/oauth/consent-flow";
import { logger } from "@/lib/logging";
import { H1 } from "@/components/ui/typography";
import { PageContainer } from "@/components/layout/page-container";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams?: Promise<{ redirect?: string | string[] }>;
}) {
  const { redirect: redirectParam } = (await searchParams) ?? {};
  // Guarded internal resume path (e.g. a pending /oauth/consent request that
  // gated on plan selection — decision D3). Same `?redirect=` mechanism and
  // open-redirect guard as the login surfaces; anything unsafe becomes null.
  // Next.js yields string[] for repeated params — normalize non-scalars to
  // null rather than crashing safeInternalPath.
  const resumePath = safeInternalPath(
    typeof redirectParam === "string" ? redirectParam : null,
  );
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

  // If user has a plan in JWT, they've completed onboarding — resume any
  // guarded pending flow (e.g. /oauth/consent), otherwise go to billing.
  if (billing?.plan) {
    if (!resumePath) {
      redirect("/billing");
    }
    // Loop guard: the consent page fails closed into /onboarding when the
    // profile row has no plan, so honoring a stale JWT claim here would
    // ping-pong between the two pages. Re-verify against the profile table
    // and only resume once it confirms a plan; otherwise fall through to
    // plan selection (a failed read also falls through — no bounce).
    const { data: profileRow } = await supabase
      .from("profile")
      .select("planSelected: plan_selected")
      .eq("id", user.id)
      .maybeSingle();
    if (hasSelectedPlan(profileRow?.planSelected)) {
      redirect(resumePath);
    }
    logger.warn("Onboarding: JWT has a plan but profile does not, re-showing plan selection", {
      userId: user.id,
    });
  }

  // If JWT billing claims are missing, this is expected for new users who haven't selected a plan yet
  logger.info("Onboarding: No plan in JWT, showing plan selection", {
    billing: billing ?? undefined,
  });

  // If no access, show onboarding
  return (
    <PageContainer>
      <div className="text-center mb-2xl">
        <H1 className="mb-md">Welcome to Handicappin!</H1>
        <p className="text-lead text-muted-foreground">
          Choose the plan that&apos;s right for you and start tracking your
          golf rounds
        </p>
      </div>

      <PlanSelector userId={user.id} mode="onboarding" resumePath={resumePath} />
    </PageContainer>
  );
}
