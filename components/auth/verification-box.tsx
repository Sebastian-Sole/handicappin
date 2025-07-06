import { CheckCircle } from "lucide-react";

const VerificationBox = () => {
  return (
    <div className="max-w-sm mx-auto">
      <div className="bg-green-50 dark:bg-green-900 border-l-4 border-green-400 dark:border-green-500 p-4 rounded-md shadow-xs">
        <div className="flex items-center">
          <div className="shrink-0">
            <CheckCircle
              className="h-5 w-5 text-green-400 dark:text-green-300"
              aria-hidden="true"
            />
          </div>
          <div className="ml-3">
            <p className="text-sm font-medium text-green-800 dark:text-green-100">
              Account Verified
            </p>
            <p className="mt-1 text-xs text-green-700 dark:text-green-200">
              Your account is now verified, login to continue.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export { VerificationBox };
