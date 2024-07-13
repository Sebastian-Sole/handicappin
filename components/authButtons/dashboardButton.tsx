"use client";
import { useRouter } from "next/navigation";
import { Button } from "../ui/button";

interface DashboardButtonProps {
  userId: string;
}

const DashboardButton = ({ userId }: DashboardButtonProps) => {
  const router = useRouter();

  const handleClick = () => {
    router.push(`/dashboard/${userId}`);
  };

  return <Button onClick={handleClick}>Dashboard</Button>;
};

export default DashboardButton;
