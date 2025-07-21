import { Login } from "@/components/auth/login";
import { createServerComponentClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import LoginSkeleton from "@/components/loading/login-skeleton";

const LoginPage = async () => {
  const supabase = createServerComponentClient();

  const { data } = await supabase.auth.getUser();
  if (data?.user) {
    redirect("/");
  }

  return (
    <div className="flex justify-center items-center h-full">
      <Login />
    </div>
  );
};

export default LoginPage;
