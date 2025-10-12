import { redirect } from "next/navigation";
import { createServerComponentClient } from "@/utils/supabase/server";
import Link from "next/link";

export default async function UpgradePage() {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-center mb-4">
          Upgrade to Premium
        </h1>
        <p className="text-lg text-center text-gray-600 mb-12">
          Unlock the dashboard, advanced calculators, and unlimited rounds!
        </p>

        <div className="grid md:grid-cols-2 gap-8 mb-8">
          {/* Premium Plan */}
          <div className="border rounded-lg p-8 shadow-lg">
            <h2 className="text-2xl font-bold mb-4">Premium</h2>
            <p className="text-gray-600 mb-6">
              Perfect for serious golfers who want to track their progress
            </p>
            <ul className="space-y-2 mb-6">
              <li className="flex items-center">
                <span className="mr-2">✓</span>
                <span>Unlimited rounds</span>
              </li>
              <li className="flex items-center">
                <span className="mr-2">✓</span>
                <span>Access to dashboard</span>
              </li>
              <li className="flex items-center">
                <span className="mr-2">✓</span>
                <span>Advanced calculators</span>
              </li>
            </ul>
            <Link
              href="/onboarding"
              className="block w-full bg-blue-600 text-white text-center py-3 rounded-lg hover:bg-blue-700 transition"
            >
              Select Premium
            </Link>
          </div>

          {/* Unlimited Plan */}
          <div className="border rounded-lg p-8 shadow-lg border-blue-500">
            <div className="inline-block bg-blue-500 text-white px-3 py-1 rounded-full text-sm mb-4">
              Best Value
            </div>
            <h2 className="text-2xl font-bold mb-4">Unlimited</h2>
            <p className="text-gray-600 mb-6">
              Everything in Premium, plus priority support
            </p>
            <ul className="space-y-2 mb-6">
              <li className="flex items-center">
                <span className="mr-2">✓</span>
                <span>Everything in Premium</span>
              </li>
              <li className="flex items-center">
                <span className="mr-2">✓</span>
                <span>Priority support</span>
              </li>
              <li className="flex items-center">
                <span className="mr-2">✓</span>
                <span>Early access to new features</span>
              </li>
            </ul>
            <Link
              href="/onboarding"
              className="block w-full bg-blue-600 text-white text-center py-3 rounded-lg hover:bg-blue-700 transition"
            >
              Select Unlimited
            </Link>
          </div>
        </div>

        <div className="text-center">
          <Link href="/" className="text-gray-600 hover:text-gray-800">
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
