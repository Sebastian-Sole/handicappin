import { Skeleton } from "@/components/ui/skeleton";

export default function AboutSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      {/* Mission Section Skeleton */}
      <section className="w-full py-12 md:py-24 lg:py-32 bg-gradient-to-br from-primary/5 to-primary/20 dark:from-primary/5 dark:to-primary/35">
        <div className="container px-4 md:px-6 mx-auto">
          <div className="mx-auto grid max-w-5xl items-start gap-6 py-12 xl:grid-cols-2 lg:gap-12">
            <div className="flex flex-col justify-start space-y-4">
              <div className="space-y-2">
                <Skeleton className="h-6 w-32 mb-2" />
                <Skeleton className="sm:h-12 h-8 w-3/4 mb-2" />
                <Skeleton className="sm:h-12 h-8 lg:w-3/4 sm:hidden block xl:block mb-2" />
                <Skeleton className="sm:h-12 h-8 xl:w-3/4 sm:w-5/10 md:w-2/10 w-full mb-8" />

                <Skeleton className="h-8 w-full mb-2" />
                <Skeleton className="h-8 w-[96%] mb-2" />
                <Skeleton className="h-8 w-[98%] mb-2" />

                <Skeleton className="xl:block sm:hidden h-8 w-[93%] mb-2" />
                <Skeleton className="xl:block sm:hidden h-8 w-[95%] mb-2" />

                <Skeleton className="h-8 w-2/3" />
              </div>
            </div>
            <div className="grid gap-12 sm:grid-cols-2 h-fit">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex items-start space-x-4">
                  <Skeleton className="h-14 w-14 rounded-lg flex-shrink-0" />
                  <div className="flex-1">
                    <Skeleton className="h-6 w-1/2 mb-8" />
                    <Skeleton className="h-6 w-full mb-1" />
                    <div className="flex flex-row gap-1">
                      <Skeleton className="h-6 w-6/10 mb-1" />
                      <Skeleton className="h-6 w-4/10 mb-1" />
                    </div>
                    <div className="flex flex-row gap-1 hidden sm:flex md:hidden xl:flex">
                      <Skeleton className="h-6 w-5/10 mb-1" />
                      <Skeleton className="h-6 w-5/10 mb-1" />
                    </div>
                    <div className="flex flex-row gap-1 hidden sm:flex md:hidden xl:flex">
                      <Skeleton className="h-6 w-7/10 mb-1" />
                      <Skeleton className="h-6 w-3/10 mb-1" />
                    </div>
                    <div className="flex flex-row gap-1 hidden sm:flex md:hidden xl:flex">
                      <Skeleton className="h-6 w-4/10 mb-1" />
                      <Skeleton className="h-6 w-6/10 mb-1" />
                    </div>
                    <Skeleton className="h-6 w-[95%] mb-1" />
                    <div className="flex flex-row gap-1 hidden sm:flex md:hidden xl:flex">
                      <Skeleton className="h-6 w-2/10 mb-1" />
                      <Skeleton className="h-6 w-8/10 mb-1" />
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
      <section className="w-full py-12 md:py-24 lg:py-32">
        <div className="container px-4 md:px-6 mx-auto">
          <div className="flex flex-col items-center justify-center space-y-4 text-center">
            <div className="space-y-2 w-full">
              <Skeleton className="h-6 w-32 mb-2 mx-auto" />
              <Skeleton className="h-16 w-1/2 mb-4 mx-auto" />
              <Skeleton className="h-6 w-[62%] mb-2 mx-auto" />
              <Skeleton className="h-6 w-[64%] mb-2 mx-auto" />
              <Skeleton className="h-6 w-[57%] mb-2 mx-auto" />
              <Skeleton className="h-6 w-[61%] mb-2 mx-auto" />
              <Skeleton className="h-6 w-[30%] mb-2 mx-auto" />
            </div>
          </div>
          <div className="mx-auto grid max-w-5xl items-center gap-6 py-12 lg:gap-12">
            <div className="flex flex-col justify-center space-y-6">
              <div className="grid gap-6 xl:grid-cols-2">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="flex items-start space-x-4">
                    <Skeleton className="h-12 w-12 rounded-lg flex-shrink-0" />
                    <div className="flex-1">
                      <Skeleton className="h-8 w-1/2 mb-2" />
                      <Skeleton className="h-4 w-full mb-1" />
                      <Skeleton className="h-4 w-2/3 mb-1" />
                      <Skeleton className="h-4 w-2/3 mb-1" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="mx-auto max-w-5xl flex flex-col items-center justify-center">
            <div className="flex flex-col gap-4 w-full sm:grid xl:grid-cols-4 sm:grid-cols-2 xl:gap-4">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="flex flex-col items-center space-y-2 rounded-lg border bg-card p-6 text-center w-full"
                >
                  <Skeleton className="h-8 w-1/2 mx-auto mb-2" />
                  <Skeleton className="h-4 w-2/3 mx-auto" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
