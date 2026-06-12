import { AuthFormShell } from "@/components/auth/auth-form-shell";
import { Skeleton } from "@/components/ui/skeleton";

export default function LoginSkeleton() {
  return (
    <div className="flex justify-center items-center h-full">
      <AuthFormShell className="py-md md:py-md lg:py-md xl:py-md">
        {/* Title Skeleton */}
        <div className="space-y-sm text-center">
          <Skeleton className="h-10 w-1/3 mx-auto mb-md" />
          <Skeleton className="h-4 w-1/4 mx-auto" />
        </div>
        {/* Form Skeleton */}
        <div className="space-y-md mt-lg">
          <div className="space-y-xl">
            <div className="space-y-sm">
              <Skeleton className="h-4 w-1/6 mb-xs" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="space-y-sm">
              <Skeleton className="h-4 w-1/6 mb-xs" />
              <Skeleton className="h-10 w-full" />
            </div>
            <Skeleton className="h-10 w-full mt-md" />
            <div className="flex flex-row items-center justify-center flex-wrap gap-xl mt-sm">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-6 w-52" />
            </div>
          </div>
        </div>
      </AuthFormShell>
    </div>
  );
}
