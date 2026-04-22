import { Skeleton } from "@/components/ui/skeleton";

export default function SignupSkeleton() {
  return (
    <div className="flex justify-center items-center h-full">
      <div className="mx-auto max-w-sm space-y-lg py-md md:py-md lg:py-md xl:py-md sm:min-w-[40%] min-h-full w-[90%]">
        {/* Title Skeleton */}
        <div className="space-y-sm text-center">
          <Skeleton className="h-10 w-1/3 mx-auto mb-md" />
          <Skeleton className="h-4 w-1/4 mx-auto" />
        </div>
        {/* Form Skeleton */}
        <div className="space-y-md mt-lg">
          <div className="space-y-xl">
            {/* Name Field */}
            <div className="space-y-sm">
              <Skeleton className="h-4 w-1/6 mb-sm" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-4 w-1/3 mt-sm" />
            </div>
            {/* Email Field */}
            <div className="space-y-sm">
              <Skeleton className="h-4 w-1/6 mb-sm" />
              <Skeleton className="h-10 w-full" />
            </div>
            {/* Password Field */}
            <div className="space-y-sm">
              <Skeleton className="h-4 w-1/6 mb-sm" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-4 w-1/3 mt-sm" />
            </div>
            {/* Submit Button */}
            <Skeleton className="h-10 w-full mt-md" />
            {/* Links */}
            <div className="flex flex-row items-center justify-center flex-wrap gap-xl mt-sm">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-6 w-52" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
