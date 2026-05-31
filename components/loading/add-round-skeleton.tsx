import { Skeleton } from "@/components/ui/skeleton";
import { H1, P } from "../ui/typography";

export default function AddRoundSkeleton() {
  return (
    <div>
      <H1 className="text-heading-1 mb-sm md:mb-md lg:mb-xl">
        Add Round
      </H1>
      <P className="text-body-sm text-muted-foreground !mt-0 mb-md md:mb-lg lg:mb-xl">
        Fill out the scorecard to register your round.
      </P>
      <Skeleton className="w-full h-[836px] sm:h-[788px] md:h-[692px] lg:h-[498px] xl:h-[498px] rounded-lg" />
    </div>
  );
}
