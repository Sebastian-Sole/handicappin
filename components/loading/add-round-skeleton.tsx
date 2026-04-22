import { Skeleton } from "@/components/ui/skeleton";
import { Large, P } from "../ui/typography";

export default function AddRoundSkeleton() {
  return (
    <div className="flex justify-center items-center flex-col h-full py-sm md:py-md lg:py-xl">
      {/* TODO: SEPARATE INTO COMPONENT */}
      <Large className="text-4xl text-primary mb-sm md:mb-md lg:mb-xl">
        Add Round
      </Large>
      <P className="text-sm text-muted-foreground !mt-0 mb-md md:mb-lg lg:mb-xl">
        Fill out the scorecard to register your round.
      </P>
      <Skeleton className="w-full h-[836px] sm:h-[788px] sm:w-[384px] md:h-[692px] md:w-[648px] lg:h-[498px] lg:w-[773px] xl:h-[498px] xl:w-[1023px] 2xl:w-[1273px] 3xl:w-[1373px] rounded-lg" />
    </div>
  );
}
