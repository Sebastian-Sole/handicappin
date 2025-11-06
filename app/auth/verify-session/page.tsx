import { VerifySessionContent } from "./verify-session-content";
import { createServerComponentClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Verifying Session | Handicappin",
  description: "Verifying your session...",
};

export default async function VerifySessionPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string; error?: string }>;
}) {
  const supabase = await createServerComponentClient();

  // Check if user is authenticated
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Await searchParams (Next.js 15+)
  const params = await searchParams;

  // Not authenticated → redirect to login
  if (!user) {
    const loginUrl = new URL("/login", process.env.NEXT_PUBLIC_SITE_URL);
    loginUrl.searchParams.set("error", "session_expired");
    if (params.returnTo) {
      loginUrl.searchParams.set("returnTo", params.returnTo);
    }
    redirect(loginUrl.toString());
  }

  // Get return URL (default to dashboard)
  const returnTo = params.returnTo || `/dashboard/${user.id}`;
  const error = params.error;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <VerifySessionContent
        userId={user.id}
        returnTo={returnTo}
        initialError={error}
      />
    </div>
  );
}
