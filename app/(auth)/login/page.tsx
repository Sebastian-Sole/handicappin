import { Login } from "@/components/login";
import { createServerComponentClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";

const LoginPage = async () => {
  const supabase = createServerComponentClient();

  const { data, error } = await supabase.auth.getUser();
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
