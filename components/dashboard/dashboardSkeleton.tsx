import { Skeleton } from "../ui/skeleton";

const DashboardSkeleton = () => {
  return (
    <div className="bg-background text-foreground p-8 rounded-lg shadow-lg h-screen">
      {/* <Skeleton className="h-10 w-1/3 mb-4" /> */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="bg-card rounded-lg p-6">
          <Skeleton className="h-8 w-1/2 mb-4" />
          <Skeleton className="h-16 w-full mb-4" />
          <Skeleton className="h-6 w-1/3 mb-12" />
          <Skeleton className="h-6 w-3/4 mb-2" />
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-4 w-1/2 mb-2" />
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-4 w-2/3 mb-2" />
          <Skeleton className="h-4 w-2/3 mb-2" />

          <Skeleton className="h-4 w-full mb-6" />
          <Skeleton className="h-4 w-2/3 mb-2" />
          <Skeleton className="h-4 w-2/3 mb-2" />
          <Skeleton className="h-4 w-2/3 mb-2" />
        </div>
        <div className="bg-card rounded-lg p-6 col-span-2 mt-16">
          <Skeleton className="h-8 w-1/3 mb-4" />
          <Skeleton className="xl:h-full h-24 w-full mb-4" />
        </div>
      </div>
      <div className="bg-card rounded-lg p-6 mt-8">
        <Skeleton className="h-8 w-1/3 mb-4" />
        <Skeleton className="h-10 w-full mb-4" />
        <Skeleton className="h-8 w-full mb-4" />
        <Skeleton className="h-8 w-full mb-4" />
        <Skeleton className="h-8 w-full mb-4" />
        <Skeleton className="h-8 w-full mb-4" />
      </div>
    </div>
  );
};

export default DashboardSkeleton;
