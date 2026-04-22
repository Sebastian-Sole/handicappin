import { Skeleton } from "@/components/ui/skeleton";
import { StatTile } from "@/components/ui/stat-tile";

export default function AboutSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      {/* Mission Section Skeleton */}
      <section className="w-full py-2xl md:py-4xl lg:py-5xl hero-gradient">
        <div className="sm:container px-md md:px-lg mx-auto">
          <div className="mx-auto grid max-w-5xl items-start gap-lg py-2xl xl:grid-cols-2 lg:gap-2xl">
            <div className="flex flex-col justify-start space-y-md">
              <div className="space-y-sm">
                <Skeleton className="h-6 w-32 mb-sm" />
                <Skeleton className="sm:h-12 h-8 w-3/4 mb-sm" />
                <Skeleton className="sm:h-12 h-8 lg:w-3/4 sm:hidden block xl:block mb-sm" />
                <Skeleton className="sm:h-12 h-8 xl:w-3/4 sm:w-5/10 md:w-2/10 w-full mb-xl" />

                <Skeleton className="h-8 w-full mb-sm" />
                <Skeleton className="h-8 w-[96%] mb-sm" />
                <Skeleton className="h-8 w-[98%] mb-sm" />

                <Skeleton className="xl:block sm:hidden h-8 w-[93%] mb-sm" />
                <Skeleton className="xl:block sm:hidden h-8 w-[95%] mb-sm" />

                <Skeleton className="h-8 w-2/3" />
              </div>
            </div>
            <div className="grid gap-2xl sm:grid-cols-2 h-fit">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex items-start space-x-md">
                  <Skeleton className="h-14 w-14 rounded-lg flex-shrink-0" />
                  <div className="flex-1">
                    <Skeleton className="h-6 w-1/2 mb-xl" />
                    <Skeleton className="h-6 w-full mb-xs" />
                    <div className="flex flex-row gap-xs">
                      <Skeleton className="h-6 w-6/10 mb-xs" />
                      <Skeleton className="h-6 w-4/10 mb-xs" />
                    </div>
                    <div className="flex flex-row gap-xs hidden sm:flex md:hidden xl:flex">
                      <Skeleton className="h-6 w-5/10 mb-xs" />
                      <Skeleton className="h-6 w-5/10 mb-xs" />
                    </div>
                    <div className="flex flex-row gap-xs hidden sm:flex md:hidden xl:flex">
                      <Skeleton className="h-6 w-7/10 mb-xs" />
                      <Skeleton className="h-6 w-3/10 mb-xs" />
                    </div>
                    <div className="flex flex-row gap-xs hidden sm:flex md:hidden xl:flex">
                      <Skeleton className="h-6 w-4/10 mb-xs" />
                      <Skeleton className="h-6 w-6/10 mb-xs" />
                    </div>
                    <Skeleton className="h-6 w-[95%] mb-xs" />
                    <div className="flex flex-row gap-xs hidden sm:flex md:hidden xl:flex">
                      <Skeleton className="h-6 w-2/10 mb-xs" />
                      <Skeleton className="h-6 w-8/10 mb-xs" />
                    </div>
                    <Skeleton className="h-6 w-[50%]" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
      {/* Why Choose Us Section Skeleton */}
      <section className="w-full py-2xl md:py-4xl lg:py-5xl">
        <div className="sm:container px-md md:px-lg mx-auto">
          <div className="flex flex-col items-center justify-center space-y-md text-center">
            <div className="space-y-sm w-full">
              <Skeleton className="h-6 w-32 mb-sm mx-auto" />
              <Skeleton className="h-16 w-1/2 mb-md mx-auto" />
              <Skeleton className="h-6 w-[62%] mb-sm mx-auto" />
              <Skeleton className="h-6 w-[64%] mb-sm mx-auto" />
              <Skeleton className="h-6 w-[57%] mb-sm mx-auto" />
              <Skeleton className="h-6 w-[61%] mb-sm mx-auto" />
              <Skeleton className="h-6 w-[30%] mb-sm mx-auto" />
            </div>
          </div>
          <div className="mx-auto grid max-w-5xl items-center gap-lg py-2xl lg:gap-2xl">
            <div className="flex flex-col justify-center space-y-lg">
              <div className="grid gap-lg xl:grid-cols-2">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="flex items-start space-x-md">
                    <Skeleton className="h-12 w-12 rounded-lg flex-shrink-0" />
                    <div className="flex-1">
                      <Skeleton className="h-8 w-1/2 mb-sm" />
                      <Skeleton className="h-4 w-full mb-xs" />
                      <Skeleton className="h-4 w-2/3 mb-xs" />
                      <Skeleton className="h-4 w-2/3 mb-xs" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="mx-auto max-w-5xl flex flex-col items-center justify-center">
            <div className="flex flex-col gap-md w-full sm:grid xl:grid-cols-4 sm:grid-cols-2 xl:gap-md">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="surface p-lg w-full">
                  <StatTile
                    value={<Skeleton className="h-8 w-1/2 mx-auto" />}
                    label={<Skeleton className="h-4 w-2/3 mx-auto" />}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
