import UpdatePassword from "@/components/profile/update-password";

const UpdatePasswordPage = async (
  props: {
    searchParams: Promise<{ email?: string }>;
  }
) => {
  const searchParams = await props.searchParams;
  const { email } = searchParams;

  return <UpdatePassword email={email} />;
};

export default UpdatePasswordPage;
