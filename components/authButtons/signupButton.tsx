"use client";
import { useRouter } from "next/navigation";
import { Button } from "../ui/button";
import { revalidatePath } from "next/cache";

const SignupButton = () => {
  const router = useRouter();
  const onClick = () => {
    router.push("/signup");
  };
  return <Button onClick={onClick}> Sign Up </Button>;
};

export default SignupButton;
