"use client";

import { ManageSubscriptionButton } from "@/components/billing/manage-subscription-button";
import { Button } from "@/components/ui/button";
import { FeatureAccess } from "@/types/billing";
import Link from "next/link";

interface BillingTabProps {
  access: FeatureAccess;
}

export function BillingTab({ access }: BillingTabProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-semibold mb-2">Billing & Subscription</h2>
        <p className="text-muted-foreground">
          Manage your subscription and view plan details
        </p>
      </div>

      {/* Current Plan Card */}
      <div className="bg-card rounded-lg border p-6">
        <h3 className="text-xl font-semibold mb-4">Current Plan</h3>
        <div className="flex items-start justify-between flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <p className="text-lg font-medium capitalize mb-2">
              {access.plan} Plan
            </p>

            {access.plan === "free" && (
              <p className="text-muted-foreground">
                {access.remainingRounds} rounds remaining
              </p>
            )}

            {access.currentPeriodEnd && !access.isLifetime && (
              <p className="text-muted-foreground">
                {access.cancelAtPeriodEnd
                  ? `Cancels on ${access.currentPeriodEnd.toLocaleDateString()}`
                  : `Renews on ${access.currentPeriodEnd.toLocaleDateString()}`}
              </p>
            )}

            {access.isLifetime && (
              <p className="text-green-600 font-medium">✓ Lifetime Access</p>
            )}
          </div>

          <div className="flex gap-3 flex-wrap">
            {/* Always show "Change Plan" for non-lifetime users */}
            {!access.isLifetime && (
              <Link href="/upgrade">
                <Button className="bg-primary text-primary-foreground px-6 py-2 rounded-lg hover:bg-primary/90 transition">
                  {access.plan === "free" ? "Upgrade Plan" : "Change Plan"}
                </Button>
              </Link>
            )}

            {/* Show subscription management for paid users only */}
            {access.plan !== "free" && !access.isLifetime && (
              <ManageSubscriptionButton />
            )}

            {/* Lifetime users: no action needed */}
            {access.isLifetime && (
              <div className="text-muted-foreground text-sm">
                No subscription management needed
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Plan Features Card */}
      <div className="bg-card rounded-lg border p-6">
        <h3 className="text-xl font-semibold mb-4">Plan Features</h3>
        <div className="space-y-4">
          {access.plan === "free" ? (
            <>
              <Feature
                included
                title="Round Logging"
                description="Basic round tracking functionality"
              />
              <Feature
                included
                title="Handicap Tracking"
                description="Calculate and track your handicap index"
              />
              <Feature
                included
                title="Score History"
                description="View your past rounds and scores"
              />
              <Feature
                included
                title="Up to 25 Rounds"
                description="Track up to 25 rounds with the free plan"
              />
              <Feature
                title="Round Calculation Insights"
                description="Upgrade to see detailed score analysis"
              />
              <Feature
                title="Advanced Calculators"
                description="Upgrade to access all calculation tools"
              />
              <Feature
                title="Personal Statistics"
                description="Upgrade to view detailed performance stats"
              />
            </>
          ) : access.plan === "premium" ? (
            <>
              <Feature
                included
                title="Unlimited Round Logging"
                description="Track as many rounds as you want"
              />
              <Feature
                included
                title="Everything from Free Tier"
                description="All basic features with no round limits"
              />
              <Feature
                title="Round Calculation Insights"
                description="Upgrade to Unlimited for detailed score analysis"
              />
              <Feature
                title="Advanced Calculators"
                description="Upgrade to Unlimited to access all calculation tools"
              />
              <Feature
                title="Personal Statistics"
                description="Upgrade to Unlimited for detailed performance stats"
              />
            </>
          ) : (
            <>
              <Feature
                included
                title="Unlimited Round Logging"
                description="Track as many rounds as you want"
              />
              <Feature
                included
                title="Round Calculation Insights"
                description="See detailed analysis of your scores"
              />
              <Feature
                included
                title="Advanced Calculators"
                description="Access all golf calculation tools"
              />
              <Feature
                included
                title="Personal Statistics"
                description="View detailed performance metrics"
              />
              <Feature
                included
                title="Early Access to New Features"
                description="Be the first to try new features"
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Helper component for feature list items
function Feature({
  included = false,
  title,
  description,
}: {
  included?: boolean;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className={included ? "text-green-500" : "text-muted-foreground"}>
        {included ? "✓" : "✗"}
      </span>
      <div className="flex-1">
        <p className={`font-medium ${!included && "text-muted-foreground"}`}>
          {title}
        </p>
        <p
          className={`text-sm ${
            included ? "text-muted-foreground" : "text-muted-foreground/60"
          }`}
        >
          {description}
        </p>
      </div>
    </div>
  );
}
