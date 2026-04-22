import { Skeleton } from "../ui/skeleton";

const DashboardSkeleton = () => {
  return (
    <div className="bg-background text-foreground p-xl rounded-lg shadow-lg min-h-screen">
      {/* <Skeleton className="h-10 w-1/3 mb-md" /> */}
      <div className="grid grid-cols-1 2xl:grid-cols-3 2xl:gap-lg">
        <div className="surface p-lg">
          {/* Top box */}
          <Skeleton className="h-8 w-1/2 mb-md" />
          <Skeleton className="h-16 w-20 mb-sm" />
          <Skeleton className="h-4 w-40 mb-sm" />
          <Skeleton className="h-4 w-72 max-w-full mb-2xl" />

          {/* Title box */}
          <Skeleton className="h-6 w-3/4 mb-sm" />
          <Skeleton className="h-6 w-3/4 mb-sm min-[378px]:hidden block 2xl:hidden" />
          <Skeleton className="h-6 w-1/4 mb-lg" />

          {/* First text */}
          <Skeleton className="h-4 w-full mb-sm" />
          <Skeleton className="h-4 w-2/3 mb-sm" />
          <Skeleton className="h-4 w-1/2 mb-sm block xl:hidden 2xl:block" />

          <Skeleton className="h-4 w-1/2 mb-sm block md:hidden 2xl:block min-[2000px]:hidden" />
          <Skeleton className="h-4 w-1/2 mb-sm block sm:hidden 2xl:block min-[2000px]:hidden" />

          <Skeleton className="h-4 w-1/2 mb-sm block sm:hidden 2xl:block 3xl:hidden" />
          <Skeleton className="h-4 w-1/2 mb-sm block min-[378px]:hidden 2xl:block 3xl:hidden" />
          <Skeleton className="h-4 w-1/2 mb-sm block min-[378px]:hidden 2xl:block 3xl:hidden" />
          <Skeleton className="h-4 w-1/2 mb-sm block min-[378px]:hidden" />
          <Skeleton className="h-4 w-1/2 mb-sm block min-[378px]:hidden" />
          <Skeleton className="h-4 w-1/2 mb-sm block min-[345px]:hidden" />
          <Skeleton className="h-4 w-1/2 mb-sm block min-[345px]:hidden" />
          <Skeleton className="h-4 w-1/2 mb-sm block min-[345px]:hidden" />
          <Skeleton className="h-4 w-1/2 mb-sm block min-[345px]:hidden" />

          <Skeleton className="h-4 w-full mb-xl" />

          {/* Second text */}
          <Skeleton className="h-4 w-full mb-sm" />
          <Skeleton className="h-4 w-full mb-sm block sm:hidden" />
          <Skeleton className="h-4 w-full mb-sm block lg:hidden 2xl:block" />
          <Skeleton className="h-4 w-full mb-sm block min-[378px]:hidden 2xl:block 3xl:hidden" />
          <Skeleton className="h-4 w-full mb-sm block min-[378px]:hidden" />
          <Skeleton className="h-4 w-1/2 mb-sm block min-[378px]:hidden" />

          <Skeleton className="h-4 w-1/2 mb-sm block min-[345px]:hidden" />
          <Skeleton className="h-4 w-1/2 mb-sm block min-[345px]:hidden" />
          <Skeleton className="h-4 w-1/2 mb-sm block min-[345px]:hidden" />
          <Skeleton className="h-4 w-1/2 mb-sm block min-[345px]:hidden" />

          <Skeleton className="h-4 w-2/3 mb-md" />

          {/* Link to learn more */}
          <Skeleton className="h-4 xl:w-1/3 w-5/6 mb-xl" />
        </div>
        <div className="surface p-lg col-span-2 overflow-hidden">
          <Skeleton className="2xl:h-full h-64 w-full max-w-full mb-md" />
        </div>
      </div>
      <div className="surface p-lg mt-xl">
        <Skeleton className="h-8 w-1/3 mb-md" />
        <Skeleton className="h-10 w-full mb-md" />
        <Skeleton className="h-8 w-full mb-md" />
        <Skeleton className="h-8 w-full mb-md" />
        <Skeleton className="h-8 w-full mb-md" />
        <Skeleton className="h-8 w-full mb-md" />
        <Skeleton className="h-8 w-full mb-md" />
        <Skeleton className="h-8 w-full mb-md" />
        <Skeleton className="h-8 w-full mb-md" />
        <Skeleton className="h-8 w-full mb-md" />
        <Skeleton className="h-8 w-full mb-md" />
        <Skeleton className="h-8 w-full mb-md" />
      </div>
    </div>
  );
};

export default DashboardSkeleton;
