"use client";
import { useRouter } from "next/navigation";
import { Button } from "../ui/button";

const LoginButton = () => {
  const router = useRouter();
  const onClick = () => {
    router.push("/login");
  };
  return <Button onClick={onClick}> Login </Button>;
};

export default LoginButton;
