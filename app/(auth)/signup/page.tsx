import { Signup } from "@/components/auth/signup";
import { Suspense } from "react";
import SignupSkeleton from "@/components/loading/signup-skeleton";

const SignupPage = () => {
  return (
    <Suspense fallback={<SignupSkeleton />}>
      <div className="flex justify-center items-center h-full">
        <Signup />
      </div>
    </Suspense>
  );
};

export default SignupPage;
