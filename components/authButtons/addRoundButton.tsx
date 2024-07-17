"use client";
import { useRouter } from "next/navigation";
import { Button } from "../ui/button";

const DashboardButton = () => {
  const router = useRouter();

  const handleClick = () => {
    router.push(`/rounds/add`);
  };

  return <Button onClick={handleClick}>Add Round</Button>;
};

export default DashboardButton;
