import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";

const AddRoundFormSkeleton = () => {
  return (
    <div className="space-y-8 mx-auto p-6 w-[40%]">
      <Card className="w-full">
        <CardHeader className="flex justify-between items-center flex-row">
          <Skeleton className="w-56 h-6" />
          <Skeleton className="w-20 h-6" />
        </CardHeader>
        <Separator />
        <CardContent className="space-y-6 pt-6">
          <div className="space-y-4">
            <Skeleton className="w-24 h-2" />
            <Skeleton className="w-[270px] h-10" />
            <Skeleton className="w-64 h-2" />
          </div>
          <div className="space-y-4">
            <Skeleton className="w-24 h-2" />
            <Skeleton className="w-full h-10" />
            <Skeleton className="w-52 h-2" />
          </div>
          <div className="flex space-x-4">
            <div className="flex-1 space-y-4">
              <Skeleton className="w-16 h-2" />
              <Skeleton className="w-full h-10" />
            </div>
            <div className="flex-1 space-y-4">
              <Skeleton className="w-32 h-4" />
              <Skeleton className="w-full h-10" />
            </div>
            <div className="flex-1 space-y-4">
              <Skeleton className="w-16 h-4" />
              <Skeleton className="w-full h-10" />
            </div>
          </div>
          <div className="space-y-4">
            <Skeleton className="w-24 h-4" />
            <Skeleton className="w-full h-10" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <Skeleton className="w-32 h-6" />
          </CardTitle>
        </CardHeader>
        <Separator />
        <CardContent className="space-y-6 pt-6">
          {Array.from({ length: 9 }).map((_, index) => (
            <div key={index} className="space-y-4 py-4">
              <Skeleton className="w-24 h-6" />
              <div className="flex space-x-4 items-start">
                <div className="flex-1 space-y-4">
                  <Skeleton className="w-16 h-4" />
                  <Skeleton className="w-full h-10" />
                </div>
                <div className="flex-1 space-y-4">
                  <Skeleton className="w-16 h-4" />
                  <Skeleton className="w-full h-10" />
                </div>
                <div className="flex-1 space-y-4">
                  <Skeleton className="w-24 h-4" />
                  <Skeleton className="w-full h-10" />
                </div>
              </div>
            </div>
          ))}
          <Skeleton className="w-32 h-10 mt-4" />
        </CardContent>
      </Card>
    </div>
  );
};

export default AddRoundFormSkeleton;
