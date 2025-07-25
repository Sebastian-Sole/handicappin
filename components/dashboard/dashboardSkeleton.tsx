import { Skeleton } from "../ui/skeleton";

const DashboardSkeleton = () => {
  return (
    <div className="bg-background text-foreground p-8 rounded-lg shadow-lg min-h-screen">
      {/* <Skeleton className="h-10 w-1/3 mb-4" /> */}
      <div className="grid grid-cols-1 2xl:grid-cols-3 2xl:gap-6">
        <div className="bg-card rounded-lg p-6">
          {/* Top box */}
          <Skeleton className="h-8 w-1/2 mb-4" />
          <Skeleton className="h-16 w-20 mb-2" />
          <Skeleton className="h-4 w-40 mb-2" />
          <Skeleton className="h-4 w-72 max-w-full mb-12" />

          {/* Title box */}
          <Skeleton className="h-6 w-3/4 mb-2" />
          <Skeleton className="h-6 w-3/4 mb-2 min-[378px]:hidden block 2xl:hidden" />
          <Skeleton className="h-6 w-1/4 mb-6" />

          {/* First text */}
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-4 w-2/3 mb-2" />
          <Skeleton className="h-4 w-1/2 mb-2 block xl:hidden 2xl:block" />

          <Skeleton className="h-4 w-1/2 mb-2 block md:hidden 2xl:block min-[2000px]:hidden" />
          <Skeleton className="h-4 w-1/2 mb-2 block sm:hidden 2xl:block min-[2000px]:hidden" />

          <Skeleton className="h-4 w-1/2 mb-2 block sm:hidden 2xl:block 3xl:hidden" />
          <Skeleton className="h-4 w-1/2 mb-2 block min-[378px]:hidden 2xl:block 3xl:hidden" />
          <Skeleton className="h-4 w-1/2 mb-2 block min-[378px]:hidden 2xl:block 3xl:hidden" />
          <Skeleton className="h-4 w-1/2 mb-2 block min-[378px]:hidden" />
          <Skeleton className="h-4 w-1/2 mb-2 block min-[378px]:hidden" />
          <Skeleton className="h-4 w-1/2 mb-2 block min-[345px]:hidden" />
          <Skeleton className="h-4 w-1/2 mb-2 block min-[345px]:hidden" />
          <Skeleton className="h-4 w-1/2 mb-2 block min-[345px]:hidden" />
          <Skeleton className="h-4 w-1/2 mb-2 block min-[345px]:hidden" />

          <Skeleton className="h-4 w-full mb-8" />

          {/* Second text */}
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-4 w-full mb-2 block sm:hidden" />
          <Skeleton className="h-4 w-full mb-2 block lg:hidden 2xl:block" />
          <Skeleton className="h-4 w-full mb-2 block min-[378px]:hidden 2xl:block 3xl:hidden" />
          <Skeleton className="h-4 w-full mb-2 block min-[378px]:hidden" />
          <Skeleton className="h-4 w-1/2 mb-2 block min-[378px]:hidden" />

          <Skeleton className="h-4 w-1/2 mb-2 block min-[345px]:hidden" />
          <Skeleton className="h-4 w-1/2 mb-2 block min-[345px]:hidden" />
          <Skeleton className="h-4 w-1/2 mb-2 block min-[345px]:hidden" />
          <Skeleton className="h-4 w-1/2 mb-2 block min-[345px]:hidden" />

          <Skeleton className="h-4 w-2/3 mb-4" />

          {/* Link to learn more */}
          <Skeleton className="h-4 xl:w-1/3 w-5/6 mb-8" />
        </div>
        <div className="bg-card rounded-lg p-6 col-span-2 overflow-hidden">
          <Skeleton className="2xl:h-full h-64 w-full max-w-full mb-4" />
        </div>
      </div>
      <div className="bg-card rounded-lg p-6 mt-8">
        <Skeleton className="h-8 w-1/3 mb-4" />
        <Skeleton className="h-10 w-full mb-4" />
        <Skeleton className="h-8 w-full mb-4" />
        <Skeleton className="h-8 w-full mb-4" />
        <Skeleton className="h-8 w-full mb-4" />
        <Skeleton className="h-8 w-full mb-4" />
        <Skeleton className="h-8 w-full mb-4" />
        <Skeleton className="h-8 w-full mb-4" />
        <Skeleton className="h-8 w-full mb-4" />
        <Skeleton className="h-8 w-full mb-4" />
        <Skeleton className="h-8 w-full mb-4" />
        <Skeleton className="h-8 w-full mb-4" />
      </div>
    </div>
  );
};

export default DashboardSkeleton;
