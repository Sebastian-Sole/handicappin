import { Skeleton } from "./ui/skeleton";

const FormSkeleton = () => {
  return (
    <div className="mt-1">
      <Skeleton className="h-[22px] w-[150px] mr-2" />
      <div className="flex flex-column justify-between w-52 align-middle">
        <div className="flex flex-row mt-4">
          <Skeleton className="h-[16px] w-[208px]" />
        </div>
      </div>
      <Skeleton className="h-[30px] w-[298px] mt-3" />
    </div>
  );
};

export default FormSkeleton;
