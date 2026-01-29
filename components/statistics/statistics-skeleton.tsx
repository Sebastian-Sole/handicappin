import { Skeleton } from "@/components/ui/skeleton";

const StatisticsSkeleton = () => {
  return (
    <div className="bg-background text-foreground p-4 md:p-8 rounded-lg min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <Skeleton className="h-9 w-48 mb-2" />
          <Skeleton className="h-5 w-64" />
        </div>
        <Skeleton className="h-10 w-40" />
      </div>

      {/* Overview Cards */}
      <div className="mb-8">
        <Skeleton className="h-7 w-48 mb-4" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, cardIndex) => (
            <Skeleton key={cardIndex} className="h-24 rounded-lg" />
          ))}
        </div>
      </div>

      {/* Course Analytics */}
      <div className="mb-8">
        <Skeleton className="h-7 w-40 mb-4" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {Array.from({ length: 3 }).map((_, highlightIndex) => (
            <Skeleton key={highlightIndex} className="h-24 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-lg" />
      </div>

      {/* Round Insights Charts */}
      <div className="mb-8">
        <Skeleton className="h-7 w-36 mb-4" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Array.from({ length: 4 }).map((_, chartIndex) => (
            <Skeleton key={chartIndex} className="h-64 rounded-lg" />
          ))}
        </div>
      </div>

      {/* Fun Facts */}
      <div>
        <Skeleton className="h-7 w-28 mb-4" />
        <Skeleton className="h-48 rounded-lg mb-6" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
          {Array.from({ length: 6 }).map((_, factIndex) => (
            <Skeleton key={factIndex} className="h-28 rounded-lg" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-48 rounded-lg" />
          <Skeleton className="h-48 rounded-lg" />
        </div>
      </div>
    </div>
  );
};

export default StatisticsSkeleton;
