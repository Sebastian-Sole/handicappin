import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export default function RoundCalculationLoading() {
  return (
    <div className="container mx-auto px-4 sm:px-6 md:px-8 py-8 space-y-8">
      {/* Round Overview Card Skeleton */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-2">
              <Skeleton className="h-8 w-64" />
              <div className="flex flex-wrap items-center gap-4">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-20" />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-center space-y-1">
                <Skeleton className="h-9 w-12 mx-auto" />
                <Skeleton className="h-4 w-10 mx-auto" />
              </div>
              <div className="text-center space-y-1">
                <Skeleton className="h-9 w-12 mx-auto" />
                <Skeleton className="h-4 w-16 mx-auto" />
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Stepper Progress Skeleton */}
      <div className="flex items-center justify-between py-4">
        {[1, 2, 3, 4].map((step) => (
          <div key={step} className="flex items-center gap-2">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-4 w-24 hidden sm:block" />
          </div>
        ))}
      </div>

      {/* Hole-by-Hole Results Skeleton */}
      <section className="space-y-4">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-96 max-w-full" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          <div className="lg:col-span-2">
            {/* Table skeleton */}
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-muted/50 p-3">
                <div className="flex gap-4">
                  {[1, 2, 3, 4, 5].map((col) => (
                    <Skeleton key={col} className="h-4 w-16" />
                  ))}
                </div>
              </div>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((row) => (
                <div key={row} className="p-3 border-t">
                  <div className="flex gap-4">
                    {[1, 2, 3, 4, 5].map((col) => (
                      <Skeleton key={col} className="h-4 w-16" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="lg:col-span-1">
            {/* Sidebar skeleton */}
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-40" />
                <div className="space-y-3 pt-4">
                  {[1, 2, 3, 4, 5].map((item) => (
                    <div key={item} className="flex justify-between">
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-4 w-8" />
                    </div>
                  ))}
                </div>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      <Separator />

      {/* Step Sections Skeleton */}
      {[1, 2, 3, 4].map((step) => (
        <div key={step}>
          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-7 w-48" />
            </div>
            <Skeleton className="h-4 w-full max-w-lg" />
            <Card>
              <CardHeader>
                <div className="space-y-3">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              </CardHeader>
            </Card>
          </section>
          {step < 4 && <Separator className="my-8" />}
        </div>
      ))}
    </div>
  );
}
