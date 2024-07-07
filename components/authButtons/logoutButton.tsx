"use client";
import { useRouter } from "next/navigation";
import { Button } from "../ui/button";
import { createClientComponentClient } from "@/utils/supabase/client";

const LogoutButton = () => {
  const router = useRouter();
  const supabase = createClientComponentClient();

  const onClick = () => {
    supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  return <Button onClick={onClick}> Logout </Button>;
};

export default LogoutButton;
