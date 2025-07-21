import { Signup } from "@/components/auth/signup";
import SignupSkeleton from "@/components/loading/signup-skeleton";

const SignupPage = () => {
  return (
    <div className="flex justify-center items-center h-full">
      <Signup />
    </div>
  );
};

export default SignupPage;
