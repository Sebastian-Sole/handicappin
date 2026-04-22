import { Skeleton } from "@/components/ui/skeleton";

const StatisticsSkeleton = () => {
  return (
    <div className="bg-background text-foreground p-md md:p-xl rounded-lg min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-xl gap-md">
        <div>
          <Skeleton className="h-9 w-48 mb-sm" />
          <Skeleton className="h-5 w-64" />
        </div>
        <Skeleton className="h-10 w-40" />
      </div>

      {/* Overview Cards */}
      <div className="mb-xl">
        <Skeleton className="h-7 w-48 mb-md" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-md">
          {Array.from({ length: 6 }).map((_, cardIndex) => (
            <Skeleton key={cardIndex} className="h-24 rounded-lg" />
          ))}
        </div>
      </div>

      {/* Course Analytics */}
      <div className="mb-xl">
        <Skeleton className="h-7 w-40 mb-md" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-md mb-lg">
          {Array.from({ length: 3 }).map((_, highlightIndex) => (
            <Skeleton key={highlightIndex} className="h-24 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-lg" />
      </div>

      {/* Round Insights Charts */}
      <div className="mb-xl">
        <Skeleton className="h-7 w-36 mb-md" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-lg">
          {Array.from({ length: 4 }).map((_, chartIndex) => (
            <Skeleton key={chartIndex} className="h-64 rounded-lg" />
          ))}
        </div>
      </div>

      {/* Fun Facts */}
      <div>
        <Skeleton className="h-7 w-28 mb-md" />
        <Skeleton className="h-48 rounded-lg mb-lg" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-md mb-lg">
          {Array.from({ length: 6 }).map((_, factIndex) => (
            <Skeleton key={factIndex} className="h-28 rounded-lg" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-lg">
          <Skeleton className="h-48 rounded-lg" />
          <Skeleton className="h-48 rounded-lg" />
        </div>
      </div>
    </div>
  );
};

export default StatisticsSkeleton;
