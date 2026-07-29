import { Login } from "@/components/auth/login";
import { safeInternalPath } from "@/lib/oauth/consent-flow";
import { createServerComponentClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import LoginSkeleton from "@/components/loading/login-skeleton";

const LoginPage = async ({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) => {
  const { redirect: redirectParam } = await searchParams;
  const supabase = await createServerComponentClient();

  const { data } = await supabase.auth.getUser();
  if (data?.user) {
    // Already signed in: honor a guarded internal resume path (e.g. a
    // pending /oauth/consent request) instead of always bouncing home.
    redirect(safeInternalPath(redirectParam) ?? "/");
  }

  return (
    <Suspense fallback={<LoginSkeleton />}>
      <div className="flex justify-center items-center h-full">
        <Login />
      </div>
    </Suspense>
  );
};

export default LoginPage;
