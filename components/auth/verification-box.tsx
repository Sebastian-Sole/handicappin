import { CheckCircle } from "lucide-react";

const VerificationBox = () => {
  return (
    <div className="max-w-sm mx-auto">
      <div className="bg-success/10 dark:bg-success/20 border-l-4 border-success p-4 rounded-md shadow-xs">
        <div className="flex items-center">
          <div className="shrink-0">
            <CheckCircle
              className="h-5 w-5 text-success"
              aria-hidden="true"
            />
          </div>
          <div className="ml-3">
            <p className="text-sm font-medium text-success">
              Account Verified
            </p>
            <p className="mt-1 text-xs text-success/80">
              Your account is now verified, login to continue.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export { VerificationBox };
