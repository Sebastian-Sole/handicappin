import { Login } from "@/components/auth/login";
import { createServerComponentClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import LoginSkeleton from "@/components/loading/login-skeleton";

const LoginPage = async () => {
  const supabase = await createServerComponentClient();

  const { data } = await supabase.auth.getUser();
  if (data?.user) {
    redirect("/");
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
