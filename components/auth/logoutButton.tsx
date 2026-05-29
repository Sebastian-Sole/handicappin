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
    <button
      type="button"
      onClick={onClick}
      className="flex w-full flex-row items-center rounded-md transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background cursor-pointer"
    >
      <LogOutIcon className="h-4 w-4 mr-sm" />
      Logout
    </button>
  );
};

export default LogoutButton;
