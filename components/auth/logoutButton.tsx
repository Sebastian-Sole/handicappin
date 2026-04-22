"use client";
import { useRouter } from "next/navigation";
import { createClientComponentClient } from "@/utils/supabase/client";
import { LogOutIcon } from "lucide-react";



const LogoutButton = () => {
  const router = useRouter();
  const supabase = createClientComponentClient();

  const onClick = () => {
    supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  return (
    <div onClick={onClick} className="flex flex-row items-center">
      <LogOutIcon className="h-4 w-4 mr-sm" />
      Logout
    </div>
  );
};

export default LogoutButton;
