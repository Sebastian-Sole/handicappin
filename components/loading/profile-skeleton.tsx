import { Skeleton } from "@/components/ui/skeleton";

export default function ProfileSkeleton() {
  return (
    <div className="mx-auto max-w-sm space-y-6 py-8 sm:min-w-[40%] min-h-full w-[90%]">
      <div className="space-y-2 text-center">
        <Skeleton className="h-10 w-1/2 mx-auto mb-4" />
      </div>
      <div className="space-y-4">
        <div className="space-y-8">
          {/* Name Field */}
          <div className="space-y-2">
            <Skeleton className="h-4 w-1/6 mb-1" />
            <Skeleton className="h-10 w-full" />
          </div>
          {/* Email Field */}
          <div className="space-y-2">
            <Skeleton className="h-4 w-1/6 mb-1" />
            <Skeleton className="h-10 w-full" />
          </div>
          {/* Submit Button */}
          <Skeleton className="h-10 w-full mt-4 mb-4" />
          {/* Link */}
          <div className="flex items-center justify-center flex-wrap gap-4 mt-2">
            <Skeleton className="h-6 w-40" />
          </div>
        </div>
      </div>
    </div>
  );
}
