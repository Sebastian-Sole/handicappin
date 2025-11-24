import { redirect } from "next/navigation";
import { createServerComponentClient } from "@/utils/supabase/server";
import { PlanSelector } from "@/components/billing/plan-selector";
import Link from "next/link";

export default async function UpgradePage() {
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

  // Manually decode JWT to get custom claims
  let billing = null;
  if (session?.access_token) {
    try {
      const parts = session.access_token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
        billing = payload.app_metadata?.billing;
      }
    } catch (e) {
      console.error('❌ Failed to decode JWT token in upgrade page:', e);
    }
  }

  // No plan in JWT - redirect to onboarding
  if (!billing?.plan) {
    console.log(`⚠️ Upgrade page: No plan in JWT, redirecting to onboarding`);
    redirect("/onboarding");
  }

  const currentPlan = billing.plan as "free" | "premium" | "unlimited" | "lifetime";

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Change Your Plan</h1>
          <p className="text-lg text-gray-600">
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
        <div className="text-center mt-12">
          <Link href="/billing" className="text-gray-600 hover:text-gray-800">
            ← Back to Billing
          </Link>
        </div>
      </div>
    </div>
  );
}
