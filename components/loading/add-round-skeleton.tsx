import { Skeleton } from "@/components/ui/skeleton";
import { Large, P } from "../ui/typography";

export default function AddRoundSkeleton() {
  return (
    <div className="flex justify-center items-center flex-col h-full py-2 md:py-4 lg:py-8">
      {/* TODO: SEPARATE INTO COMPONENT */}
      <Large className="text-4xl text-primary mb-2 md:mb-4 lg:mb-8">
        Add Round
      </Large>
      <P className="text-sm text-muted-foreground !mt-0 mb-4 md:mb-6 lg:mb-8">
        Fill out the scorecard to register your round.
      </P>
      <Skeleton className="w-full h-[836px] sm:h-[788px] sm:w-[384px] md:h-[692px] md:w-[648px] lg:h-[498px] lg:w-[773px] xl:h-[498px] xl:w-[1023px] 2xl:w-[1273px] 3xl:w-[1373px] rounded-lg" />
    </div>
  );
}
