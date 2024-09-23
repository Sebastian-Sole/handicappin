import { Login } from "@/components/auth/login";
import { createServerComponentClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";

const LoginPage = async () => {
  const supabase = createServerComponentClient();

  const { data } = await supabase.auth.getUser();
  if (data?.user) {
    redirect("/");
  }

  console.log(data);

  return (
    <div className="flex justify-center items-center h-full">
      <Login />
    </div>
  );
};

export default LoginPage;
