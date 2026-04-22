import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

export default function HomepageSkeleton() {
  return (
    <div className="flex flex-col min-h-screen">
      <main className="flex-1">
        {/* Hero Section Skeleton */}
        <section className="w-full py-lg md:py-xl lg:py-2xl bg-gradient-to-b from-primary/5 to-background">
          <div className="container px-md lg:px-lg">
            {/* Welcome Header */}
            <div className="mb-xl">
              <Skeleton className="h-7 w-48 mb-sm" />
              <Skeleton className="h-4 w-32" />
            </div>

            {/* Main Content Grid */}
            <div className="grid gap-lg lg:grid-cols-[1fr_1.5fr] lg:gap-2xl">
              {/* Left: Handicap Display + CTAs */}
              <div className="flex flex-col items-center lg:items-start space-y-lg">
                {/* Handicap Display */}
                <div className="py-lg flex flex-col items-center">
                  <Skeleton className="h-4 w-28 mb-sm" />
                  <Skeleton className="h-20 w-32 md:h-24 md:w-40 lg:h-28 lg:w-48" />
                  <Skeleton className="h-6 w-40 mt-sm rounded-full" />
                </div>

                {/* CTA Buttons */}
                <div className="flex flex-col sm:flex-row gap-sm w-full max-w-sm">
                  <Skeleton className="h-11 flex-1" />
                  <Skeleton className="h-11 flex-1" />
                </div>
              </div>

              {/* Right: Stat Cards Grid */}
              <div className="grid grid-cols-2 gap-sm md:gap-md">
                {[...Array(4)].map((_, i) => (
                  <Card key={i} className="p-md md:p-md">
                    <div className="flex items-start justify-between mb-sm">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-5 w-5" />
                    </div>
                    <Skeleton className="h-8 w-16 mb-xs" />
                    <Skeleton className="h-3 w-20 mb-sm" />
                    <Skeleton className="h-8 w-full mt-sm" />
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Charts Section Skeleton - Desktop only */}
        <section className="hidden md:block w-full py-xl lg:py-2xl bg-muted/30">
          <div className="container px-md lg:px-lg">
            <Skeleton className="h-6 w-48 mb-lg" />

            {/* Desktop: Full charts */}
            <div className="grid gap-lg xl:grid-cols-2">
              <Skeleton className="h-80 w-full rounded-lg" />
              <Skeleton className="h-80 w-full rounded-lg" />
            </div>
          </div>
        </section>

        {/* Activity Feed Section Skeleton */}
        <section className="w-full py-xl lg:py-2xl bg-muted/30">
          <div className="container px-md lg:px-lg">
            <div className="grid gap-lg lg:grid-cols-[2fr_1fr]">
              {/* Activity Feed */}
              <Card className="p-lg">
                <div className="flex items-center justify-between mb-md">
                  <Skeleton className="h-6 w-32" />
                  <Skeleton className="h-4 w-16" />
                </div>
                <div className="space-y-md">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex items-start gap-sm">
                      <Skeleton className="h-2 w-2 rounded-full mt-sm" />
                      <div className="flex-1 space-y-sm">
                        <div className="flex items-center justify-between">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-3 w-12" />
                        </div>
                        <Skeleton className="h-3 w-48" />
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Quick Actions */}
              <div className="grid grid-cols-2 lg:grid-cols-2 gap-sm">
                {[...Array(4)].map((_, i) => (
                  <Card key={i} className="p-md flex flex-col items-center gap-sm">
                    <Skeleton className="h-6 w-6" />
                    <Skeleton className="h-4 w-16" />
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
