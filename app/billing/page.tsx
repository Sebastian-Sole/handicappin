import { redirect } from "next/navigation";
import { createServerComponentClient } from "@/utils/supabase/server";
import { getComprehensiveUserAccess } from "@/utils/billing/access-control";
import { ManageSubscriptionButton } from "@/components/billing/manage-subscription-button";

export default async function BillingPage() {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const access = await getComprehensiveUserAccess(user.id);

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">Billing & Subscription</h1>

        <div className="bg-white rounded-lg shadow-md p-8 mb-8">
          <h2 className="text-2xl font-semibold mb-4">Current Plan</h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-lg font-medium capitalize">{access.plan} Plan</p>
              {access.plan === "free" && (
                <p className="text-gray-600 mt-1">
                  {access.remainingRounds} rounds remaining
                </p>
              )}
              {access.currentPeriodEnd && (
                <p className="text-gray-600 mt-1">
                  Renews on {access.currentPeriodEnd.toLocaleDateString()}
                </p>
              )}
            </div>
            {access.plan === "free" ? (
              <a
                href="/upgrade"
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition"
              >
                Upgrade Plan
              </a>
            ) : (
              <ManageSubscriptionButton />
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-8">
          <h2 className="text-2xl font-semibold mb-4">Plan Features</h2>
          <div className="space-y-4">
            {access.plan === "free" ? (
              <>
                <div className="flex items-start">
                  <span className="text-green-500 mr-3">✓</span>
                  <div>
                    <p className="font-medium">25 Rounds</p>
                    <p className="text-gray-600 text-sm">
                      Track up to 25 rounds with the free plan
                    </p>
                  </div>
                </div>
                <div className="flex items-start">
                  <span className="text-green-500 mr-3">✓</span>
                  <div>
                    <p className="font-medium">Handicap Tracking</p>
                    <p className="text-gray-600 text-sm">
                      Calculate and track your handicap index
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-start">
                  <span className="text-green-500 mr-3">✓</span>
                  <div>
                    <p className="font-medium">Unlimited Rounds</p>
                    <p className="text-gray-600 text-sm">
                      Track as many rounds as you want
                    </p>
                  </div>
                </div>
                <div className="flex items-start">
                  <span className="text-green-500 mr-3">✓</span>
                  <div>
                    <p className="font-medium">Dashboard Analytics</p>
                    <p className="text-gray-600 text-sm">
                      View detailed statistics and trends
                    </p>
                  </div>
                </div>
                <div className="flex items-start">
                  <span className="text-green-500 mr-3">✓</span>
                  <div>
                    <p className="font-medium">Advanced Calculators</p>
                    <p className="text-gray-600 text-sm">
                      Access all golf calculation tools
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
