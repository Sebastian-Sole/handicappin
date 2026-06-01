import { AuthFormShell } from "@/components/auth/auth-form-shell";
import { Skeleton } from "@/components/ui/skeleton";

export default function ProfileSkeleton() {
  return (
    <AuthFormShell className="py-xl">
      <div className="space-y-sm text-center">
        <Skeleton className="h-10 w-1/2 mx-auto mb-md" />
      </div>
      <div className="space-y-md">
        <div className="space-y-xl">
          {/* Name Field */}
          <div className="space-y-sm">
            <Skeleton className="h-4 w-1/6 mb-xs" />
            <Skeleton className="h-10 w-full" />
          </div>
          {/* Email Field */}
          <div className="space-y-sm">
            <Skeleton className="h-4 w-1/6 mb-xs" />
            <Skeleton className="h-10 w-full" />
          </div>
          {/* Submit Button */}
          <Skeleton className="h-10 w-full mt-md mb-md" />
          {/* Link */}
          <div className="flex items-center justify-center flex-wrap gap-md mt-sm">
            <Skeleton className="h-6 w-40" />
          </div>
        </div>
      </div>
    </AuthFormShell>
  );
}
