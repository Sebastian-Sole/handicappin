import UpdatePassword from "@/components/profile/update-password";
import { redirect } from "next/navigation";

const UpdatePasswordPage = async (
  props: {
    searchParams: Promise<{ token?: string; email?: string }>;
  }
) => {
  const searchParams = await props.searchParams;
  const { email, token } = searchParams;

  if (!token) {
    redirect("/forgot-password");
  }

  if (!email) {
    redirect("/forgot-password");
  }

  return <UpdatePassword token={token} email={email} />;
};

export default UpdatePasswordPage;
