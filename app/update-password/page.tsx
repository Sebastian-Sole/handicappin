import UpdatePassword from "@/components/profile/update-password";
import { redirect } from "next/navigation";

const UpdatePasswordPage = async ({
  searchParams,
}: {
  searchParams: { token?: string; email?: string };
}) => {
  const { email, token } = searchParams;

  console.log(token);
  if (!token) {
    redirect("/forgot-password");
  }

  if (!email) {
    redirect("/forgot-password");
  }

  return <UpdatePassword token={token} email={email} />;
};

export default UpdatePasswordPage;
