import { Skeleton } from "@/components/ui/skeleton";

export default function HomepageSkeleton() {
  return (
    <div className="flex flex-col min-h-screen">
      <main className="flex-1">
        {/* Hero Section Skeleton */}
        <section className="w-full py-4 lg:py-8 xl:py-12 2xl:py-24 bg-gradient-to-r from-primary/5 to-primary/20 min-h-[650px]">
          <div className="sm:container px-4 lg:px-6">
            <div className="grid gap-6 xl:grid-cols-[1fr_460px] xl:gap-12 2xl:grid-cols-[1fr_600px]">
              {/* Left: Welcome and Actions */}
              <div className="flex flex-col justify-between space-y-4 backdrop-blur-xs rounded-xl shadow-lg h-full p-6">
                <div className="space-y-4">
                  <Skeleton className="h-8 sm:w-1/2 w-7/8 mb-2" />
                  <Skeleton className="h-4 sm:w-1/3 w-6/8 mb-4" />
                  <Skeleton className="h-16 sm:w-2/3 w-6/8 mb-3" />
                  <Skeleton className="h-16 sm:w-1/3 w-1/2 mb-3" />
                  <Skeleton className="h-4 sm:w-1/2 w-full mb-2" />
                  <Skeleton className="h-6 sm:w-1/2 w-full mb-2" />
                  <div className="flex flex-col gap-2 min-[460px]:flex-row mt-4">
                    <Skeleton className="h-10 sm:w-40 w-full " />
                    <Skeleton className="h-10 sm:w-40 w-full" />
                  </div>
                </div>
              </div>
              {/* Right: Stat Boxes */}
              <div className="space-y-6">
                <Skeleton className="sm:h-6 h-12 w-1/3 mb-4" />
                <div className="grid grid-cols-2 gap-6">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="">
                      <Skeleton className="h-42 w-full rounded-lg" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
        {/* Performance Analytics Section Skeleton */}
        <section className="w-full py-8 lg:py-18 xl:py-24">
          <div className="sm:container px-4 lg:px-6">
            <div className="text-center md:mb-12 mb-6">
              <Skeleton className="h-12 w-1/4 mx-auto mb-4" />
              <Skeleton className="h-6 w-1/2 mx-auto" />
            </div>
            <div className="hidden md:grid gap-6 2xl:grid-cols-2 2xl:gap-12">
              <Skeleton className="h-100 w-full rounded-lg" />
              <Skeleton className="h-100 w-full rounded-lg" />
            </div>
            <div className="grid gap-6 md:hidden">
              <div className="flex justify-center">
                <Skeleton className="h-10 w-48" />
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
