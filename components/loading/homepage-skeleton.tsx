import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

export default function HomepageSkeleton() {
  return (
    <div className="flex flex-col min-h-screen">
      <main className="flex-1">
        {/* Hero Section Skeleton */}
        <section className="w-full py-6 md:py-10 lg:py-12 bg-gradient-to-b from-primary/5 to-background">
          <div className="container px-4 lg:px-6">
            {/* Welcome Header */}
            <div className="mb-8">
              <Skeleton className="h-7 w-48 mb-2" />
              <Skeleton className="h-4 w-32" />
            </div>

            {/* Main Content Grid */}
            <div className="grid gap-6 lg:grid-cols-[1fr_1.5fr] lg:gap-10">
              {/* Left: Handicap Display + CTAs */}
              <div className="flex flex-col items-center lg:items-start space-y-6">
                {/* Handicap Display */}
                <div className="py-6 flex flex-col items-center">
                  <Skeleton className="h-4 w-28 mb-2" />
                  <Skeleton className="h-20 w-32 md:h-24 md:w-40 lg:h-28 lg:w-48" />
                  <Skeleton className="h-6 w-40 mt-3 rounded-full" />
                </div>

                {/* CTA Buttons */}
                <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm">
                  <Skeleton className="h-11 flex-1" />
                  <Skeleton className="h-11 flex-1" />
                </div>
              </div>

              {/* Right: Stat Cards Grid */}
              <div className="grid grid-cols-2 gap-3 md:gap-4">
                {[...Array(4)].map((_, i) => (
                  <Card key={i} className="p-4 md:p-5">
                    <div className="flex items-start justify-between mb-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-5 w-5" />
                    </div>
                    <Skeleton className="h-8 w-16 mb-1" />
                    <Skeleton className="h-3 w-20 mb-2" />
                    <Skeleton className="h-8 w-full mt-3" />
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Charts Section Skeleton - Desktop only */}
        <section className="hidden md:block w-full py-8 lg:py-12 bg-muted/30">
          <div className="container px-4 lg:px-6">
            <Skeleton className="h-6 w-48 mb-6" />

            {/* Desktop: Full charts */}
            <div className="grid gap-6 xl:grid-cols-2">
              <Skeleton className="h-80 w-full rounded-lg" />
              <Skeleton className="h-80 w-full rounded-lg" />
            </div>
          </div>
        </section>

        {/* Activity Feed Section Skeleton */}
        <section className="w-full py-8 lg:py-12 bg-muted/30">
          <div className="container px-4 lg:px-6">
            <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
              {/* Activity Feed */}
              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <Skeleton className="h-6 w-32" />
                  <Skeleton className="h-4 w-16" />
                </div>
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <Skeleton className="h-2 w-2 rounded-full mt-2" />
                      <div className="flex-1 space-y-2">
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
              <div className="grid grid-cols-2 lg:grid-cols-2 gap-3">
                {[...Array(4)].map((_, i) => (
                  <Card key={i} className="p-4 flex flex-col items-center gap-2">
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
