import UserProfile from "@/components/profile/user-profile";
import { toast } from "@/components/ui/use-toast";
import { api } from "@/trpc/server";
import { createServerComponentClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import ProfileSkeleton from "@/components/loading/profile-skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const ProfilePage = async (props: { params: Promise<{ id: string }> }) => {
  const params = await props.params;
  const { id: profileId } = params;

  if (!profileId) {
    return <div>Invalid profile id</div>;
  }

  const supabase = await createServerComponentClient();

  const { data, error } = await supabase.auth.getUser();

  if (!data || error) {
    redirect("/login");
  }

  if (data.user.id !== profileId) {
    // TODO: Is this the correct instantiation of the toast?
    toast({
      title: "Unauthorized",
      description: "You do not have permission to view this profile",
      variant: "destructive",
    });
    redirect("/404");
  }

  const profile = await api.auth.getProfileFromUserId(profileId);

  if (!profile) {
    redirect("/404");
  }

  // Fetch Stripe subscription data for debugging
  let stripeData: {
    hasStripeCustomer: boolean;
    stripeCustomerId: string;
    subscriptions: any[];
    error?: string;
  } | null = null;
  try {
    // Get the Stripe customer ID from the database
    const { data: stripeCustomer } = await supabase
      .from("stripe_customers")
      .select("stripe_customer_id")
      .eq("user_id", data.user.id)
      .single();

    if (stripeCustomer?.stripe_customer_id) {
      console.log("Stripe customer ID:", stripeCustomer.stripe_customer_id);
      // Import stripe and mapPriceToPlan dynamically to avoid server-side issues
      const { stripe, mapPriceToPlan } = await import("@/lib/stripe");

      // Get subscriptions from Stripe
      const subscriptions = await stripe.subscriptions.list({
        customer: stripeCustomer.stripe_customer_id,
        limit: 10,
        // no special expand needed for the period fields on items
      });

      const subscriptionData = subscriptions.data.map((sub) => {
        const items = sub.items.data;
        // Pick your "primary" item. If you have multiple, choose by priceId instead of [0].
        const item = items[0];

        return {
          id: sub.id,
          status: sub.status,
          currentPeriodStart: item?.current_period_start
            ? new Date(item.current_period_start * 1000)
            : null,
          currentPeriodEnd: item?.current_period_end
            ? new Date(item.current_period_end * 1000)
            : null,
          priceId: item?.price.id,
          plan: mapPriceToPlan(item?.price.id || ""),
          cancelAtPeriodEnd: sub.cancel_at_period_end,
          canceledAt: sub.canceled_at ? new Date(sub.canceled_at * 1000) : null,
          metadata: sub.metadata,
        };
      });

      stripeData = {
        hasStripeCustomer: true,
        stripeCustomerId: stripeCustomer.stripe_customer_id,
        subscriptions: subscriptionData,
      };
    } else {
      console.log("No Stripe customer found");
      stripeData = {
        hasStripeCustomer: false,
        stripeCustomerId: "",
        subscriptions: [],
        error: "No Stripe customer found",
      };
    }
  } catch (error) {
    console.error("Failed to fetch Stripe data:", error);
    stripeData = {
      hasStripeCustomer: false,
      stripeCustomerId: "",
      subscriptions: [],
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }

  return (
    <div className="container mx-auto py-8 space-y-8">
      {/* Plan Debugging Section */}
      <Card>
        <CardHeader>
          <CardTitle>Plan Debugging Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Supabase Plan Data */}
          <div>
            <h3 className="font-semibold mb-2">Supabase Profile Data:</h3>
            <div className="bg-gray-50 p-3 rounded-md space-y-1">
              <div>
                <strong>Plan Selected:</strong>{" "}
                <Badge variant="outline">
                  {profile.plan_selected || "null"}
                </Badge>
              </div>
              <div>
                <strong>Plan Selected At:</strong>{" "}
                {profile.plan_selected_at
                  ? new Date(profile.plan_selected_at).toLocaleString()
                  : "null"}
              </div>
              <div>
                <strong>Rounds Used:</strong> {profile.rounds_used}
              </div>
              <div>
                <strong>User ID:</strong>{" "}
                <code className="text-xs">{profile.id}</code>
              </div>
            </div>
          </div>

          {/* Stripe Data */}
          <div>
            <h3 className="font-semibold mb-2">Stripe Data:</h3>
            {stripeData ? (
              <div className="bg-gray-50 p-3 rounded-md space-y-2">
                <div>
                  <strong>Has Stripe Customer:</strong>{" "}
                  <Badge
                    variant={
                      stripeData.hasStripeCustomer ? "default" : "secondary"
                    }
                  >
                    {stripeData.hasStripeCustomer ? "Yes" : "No"}
                  </Badge>
                </div>
                {stripeData.hasStripeCustomer && (
                  <div>
                    <strong>Stripe Customer ID:</strong>{" "}
                    <code className="text-xs">
                      {stripeData.stripeCustomerId}
                    </code>
                  </div>
                )}
                <div>
                  <strong>Active Subscriptions:</strong>{" "}
                  {stripeData.subscriptions?.length || 0}
                </div>

                {stripeData.subscriptions &&
                  stripeData.subscriptions.length > 0 && (
                    <div className="mt-3">
                      <h4 className="font-medium mb-2">
                        Subscription Details:
                      </h4>
                      {stripeData.subscriptions.map((sub: any) => (
                          <div
                            key={sub.id}
                            className="bg-white p-2 rounded border mb-2"
                          >
                            <div>
                              <strong>Status:</strong>{" "}
                              <Badge
                                variant={
                                  sub.status === "active"
                                    ? "default"
                                    : "secondary"
                                }
                              >
                                {sub.status}
                              </Badge>
                            </div>
                            <div>
                              <strong>Plan:</strong>{" "}
                              <Badge variant="outline">
                                {sub.plan || "Unknown"}
                              </Badge>
                            </div>
                            <div>
                              <strong>Price ID:</strong>{" "}
                              <code className="text-xs">{sub.priceId}</code>
                            </div>
                            <div>
                              <strong>Current Period:</strong>{" "}
                              {sub.currentPeriodStart.toLocaleDateString()} -{" "}
                              {sub.currentPeriodEnd.toLocaleDateString()}
                            </div>
                            {sub.cancelAtPeriodEnd && (
                              <div>
                                <strong>Cancel at Period End:</strong>{" "}
                                <Badge variant="destructive">Yes</Badge>
                              </div>
                            )}
                            {sub.canceledAt && (
                              <div>
                                <strong>Canceled At:</strong>{" "}
                                {sub.canceledAt.toLocaleString()}
                              </div>
                            )}
                          </div>
                        )
                      )}
                    </div>
                  )}
              </div>
            ) : (
              <div className="bg-red-50 p-3 rounded-md">
                <Badge variant="destructive">Failed to fetch Stripe data</Badge>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Original Profile Component */}
      <Suspense fallback={<ProfileSkeleton />}>
        <UserProfile authUser={data.user} profile={profile} />
      </Suspense>
    </div>
  );
};

export default ProfilePage;
