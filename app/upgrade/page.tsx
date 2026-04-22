import { redirect } from "next/navigation";
import { createServerComponentClient } from "@/utils/supabase/server";
import { PlanSelector } from "@/components/billing/plan-selector";
import Link from "next/link";
import { getBillingFromJWT } from "@/utils/supabase/jwt";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { logger } from "@/lib/logging";
import { H1 } from "@/components/ui/typography";

interface UpgradePageProps {
  searchParams: Promise<{ expired?: string }>;
}

export default async function UpgradePage({ searchParams }: UpgradePageProps) {
  const params = await searchParams;
  const isExpired = params.expired === "true";
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Get current plan from JWT (consistent with middleware)
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Decode JWT to get custom claims
  // SECURITY: Safe to use for routing - JWT signature already verified by getSession()
  // See getBillingFromJWT() for full security documentation
  const billing = getBillingFromJWT(session);

  // No plan in JWT - redirect to onboarding
  if (!billing?.plan) {
    logger.warn("Upgrade page: No plan in JWT, redirecting to onboarding");
    redirect("/onboarding");
  }

  const validPlans = ["free", "premium", "unlimited", "lifetime"] as const;
  const currentPlan = (validPlans as readonly string[]).includes(billing.plan)
    ? billing.plan as typeof validPlans[number]
    : "free";

  return (
    <div className="sm:container mx-auto px-md py-3xl">
      <div className="max-w-6xl mx-auto">
        {/* Expired subscription alert */}
        {isExpired && (
          <Alert className="mb-xl tint-warning">
            <AlertCircle className="h-4 w-4 text-warning" />
            <AlertDescription className="text-warning">
              Your premium subscription has ended. Upgrade to continue accessing premium features.
            </AlertDescription>
          </Alert>
        )}

        <div className="text-center mb-2xl">
          <H1 className="mb-md">Change Your Plan</H1>
          <p className="text-lg text-muted-foreground">
            Currently on: <span className="font-semibold capitalize">{currentPlan}</span> Plan
          </p>
        </div>

        {/* Context-aware plan selector */}
        <PlanSelector
          userId={user.id}
          currentPlan={currentPlan}
          mode="upgrade"
        />

        {/* Back to billing link */}
        <div className="text-center mt-2xl">
          <Link href="/billing" className="text-muted-foreground hover:text-foreground">
            ← Back to Billing
          </Link>
        </div>
      </div>
    </div>
  );
}
