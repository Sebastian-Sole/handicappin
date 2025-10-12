import { redirect } from "next/navigation";
import { createServerComponentClient } from "@/utils/supabase/server";
import Link from "next/link";

export default async function BillingSuccessPage() {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="max-w-2xl mx-auto text-center">
        <div className="mb-8">
          <div className="text-6xl mb-4">✅</div>
          <h1 className="text-4xl font-bold mb-4">Welcome to Premium!</h1>
          <p className="text-lg text-gray-600 mb-8">
            Your subscription is now active. You now have access to all premium
            features including the dashboard, advanced calculators, and unlimited
            rounds.
          </p>
        </div>

        <div className="space-y-4">
          <Link
            href={`/dashboard/${user.id}`}
            className="block w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition"
          >
            Go to Dashboard
          </Link>
          <Link
            href="/"
            className="block w-full border border-gray-300 px-6 py-3 rounded-lg hover:bg-gray-50 transition"
          >
            Back to Home
          </Link>
        </div>

        <div className="mt-8 pt-8 border-t">
          <p className="text-sm text-gray-600">
            Need help? Contact us at{" "}
            <a
              href="mailto:support@handicappin.com"
              className="text-blue-600 hover:underline"
            >
              support@handicappin.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
