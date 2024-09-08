"use client";
import { useRouter } from "next/navigation";
import { createClientComponentClient } from "@/utils/supabase/client";
import { LogOutIcon } from "lucide-react";

interface LogoutButtonProps {
  className?: string;
}

const LogoutButton = ({ className }: LogoutButtonProps) => {
  const router = useRouter();
  const supabase = createClientComponentClient();

  const onClick = () => {
    supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  return (
    <div onClick={onClick} className="flex flex-row items-center">
      <LogOutIcon className="h-4 w-4 mr-2" />
      Logout
    </div>
  );
};

export default LogoutButton;
