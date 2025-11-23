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
              {access.currentPeriodEnd && !access.isLifetime && (
                <p className="text-gray-600 mt-1">
                  {access.cancelAtPeriodEnd
                    ? `Cancels on ${access.currentPeriodEnd.toLocaleDateString()}`
                    : `Renews on ${access.currentPeriodEnd.toLocaleDateString()}`}
                </p>
              )}
              {access.isLifetime && (
                <p className="text-green-600 mt-1 font-medium">
                  ✓ Lifetime Access
                </p>
              )}
            </div>

            <div className="flex gap-4">
              {/* Always show "Change Plan" for non-lifetime users */}
              {!access.isLifetime && (
                <a
                  href="/upgrade"
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition"
                >
                  {access.plan === "free" ? "Upgrade Plan" : "Change Plan"}
                </a>
              )}

              {/* Show subscription management for paid users only */}
              {access.plan !== "free" && !access.isLifetime && (
                <ManageSubscriptionButton />
              )}

              {/* Lifetime users: no action needed */}
              {access.isLifetime && (
                <div className="text-gray-500 text-sm">
                  No subscription management needed
                </div>
              )}
            </div>
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
                    <p className="font-medium">Round Logging</p>
                    <p className="text-gray-600 text-sm">
                      Basic round tracking functionality
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
                <div className="flex items-start">
                  <span className="text-green-500 mr-3">✓</span>
                  <div>
                    <p className="font-medium">Score History</p>
                    <p className="text-gray-600 text-sm">
                      View your past rounds and scores
                    </p>
                  </div>
                </div>
                <div className="flex items-start">
                  <span className="text-green-500 mr-3">✓</span>
                  <div>
                    <p className="font-medium">Up to 25 Rounds</p>
                    <p className="text-gray-600 text-sm">
                      Track up to 25 rounds with the free plan
                    </p>
                  </div>
                </div>
                <div className="flex items-start">
                  <span className="text-red-500 mr-3">✗</span>
                  <div>
                    <p className="font-medium text-gray-400">Round Calculation Insights</p>
                    <p className="text-gray-400 text-sm">
                      Upgrade to see detailed score analysis
                    </p>
                  </div>
                </div>
                <div className="flex items-start">
                  <span className="text-red-500 mr-3">✗</span>
                  <div>
                    <p className="font-medium text-gray-400">Advanced Calculators</p>
                    <p className="text-gray-400 text-sm">
                      Upgrade to access all calculation tools
                    </p>
                  </div>
                </div>
                <div className="flex items-start">
                  <span className="text-red-500 mr-3">✗</span>
                  <div>
                    <p className="font-medium text-gray-400">Personal Statistics</p>
                    <p className="text-gray-400 text-sm">
                      Upgrade to view detailed performance stats
                    </p>
                  </div>
                </div>
              </>
            ) : access.plan === "premium" ? (
              <>
                <div className="flex items-start">
                  <span className="text-green-500 mr-3">✓</span>
                  <div>
                    <p className="font-medium">Unlimited Round Logging</p>
                    <p className="text-gray-600 text-sm">
                      Track as many rounds as you want
                    </p>
                  </div>
                </div>
                <div className="flex items-start">
                  <span className="text-green-500 mr-3">✓</span>
                  <div>
                    <p className="font-medium">Everything from Free Tier</p>
                    <p className="text-gray-600 text-sm">
                      All basic features with no round limits
                    </p>
                  </div>
                </div>
                <div className="flex items-start">
                  <span className="text-red-500 mr-3">✗</span>
                  <div>
                    <p className="font-medium text-gray-400">Round Calculation Insights</p>
                    <p className="text-gray-400 text-sm">
                      Upgrade to Unlimited for detailed score analysis
                    </p>
                  </div>
                </div>
                <div className="flex items-start">
                  <span className="text-red-500 mr-3">✗</span>
                  <div>
                    <p className="font-medium text-gray-400">Advanced Calculators</p>
                    <p className="text-gray-400 text-sm">
                      Upgrade to Unlimited to access all calculation tools
                    </p>
                  </div>
                </div>
                <div className="flex items-start">
                  <span className="text-red-500 mr-3">✗</span>
                  <div>
                    <p className="font-medium text-gray-400">Personal Statistics</p>
                    <p className="text-gray-400 text-sm">
                      Upgrade to Unlimited for detailed performance stats
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-start">
                  <span className="text-green-500 mr-3">✓</span>
                  <div>
                    <p className="font-medium">Unlimited Round Logging</p>
                    <p className="text-gray-600 text-sm">
                      Track as many rounds as you want
                    </p>
                  </div>
                </div>
                <div className="flex items-start">
                  <span className="text-green-500 mr-3">✓</span>
                  <div>
                    <p className="font-medium">Round Calculation Insights</p>
                    <p className="text-gray-600 text-sm">
                      See detailed analysis of your scores
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
                <div className="flex items-start">
                  <span className="text-green-500 mr-3">✓</span>
                  <div>
                    <p className="font-medium">Personal Statistics</p>
                    <p className="text-gray-600 text-sm">
                      View detailed performance metrics
                    </p>
                  </div>
                </div>
                <div className="flex items-start">
                  <span className="text-green-500 mr-3">✓</span>
                  <div>
                    <p className="font-medium">Early Access to New Features</p>
                    <p className="text-gray-600 text-sm">
                      Be the first to try new features
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
