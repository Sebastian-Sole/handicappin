import { Skeleton } from "@/components/ui/skeleton";

export default function SignupSkeleton() {
  return (
    <div className="flex justify-center items-center h-full">
      <div className="mx-auto max-w-sm space-y-6 py-4 md:py-4 lg:py-4 xl:py-4 sm:min-w-[40%] min-h-full w-[90%]">
        {/* Title Skeleton */}
        <div className="space-y-2 text-center">
          <Skeleton className="h-10 w-1/3 mx-auto mb-4" />
          <Skeleton className="h-4 w-1/4 mx-auto" />
        </div>
        {/* Form Skeleton */}
        <div className="space-y-4 mt-6">
          <div className="space-y-8">
            {/* Name Field */}
            <div className="space-y-2">
              <Skeleton className="h-4 w-1/6 mb-2" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-4 w-1/3 mt-2" />
            </div>
            {/* Email Field */}
            <div className="space-y-2">
              <Skeleton className="h-4 w-1/6 mb-2" />
              <Skeleton className="h-10 w-full" />
            </div>
            {/* Password Field */}
            <div className="space-y-2">
              <Skeleton className="h-4 w-1/6 mb-2" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-4 w-1/3 mt-2" />
            </div>
            {/* Submit Button */}
            <Skeleton className="h-10 w-full mt-4" />
            {/* Links */}
            <div className="flex flex-row items-center justify-center flex-wrap gap-8 mt-2">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-6 w-52" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
