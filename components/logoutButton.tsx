"use client";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button";
import { createClientComponentClient } from "@/utils/supabase/client";

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
    <Button onClick={onClick} className={className}>
      {" "}
      Logout{" "}
    </Button>
  );
};

export default LogoutButton;
