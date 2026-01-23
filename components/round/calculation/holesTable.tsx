import { calculateHoleAdjustedScore } from "@/lib/handicap";
import { InfoIcon } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useRoundCalculationContext } from "@/contexts/roundCalculationContext";
import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

const HolesTable = () => {
  const { scorecard, hasEstablishedHandicap, isNineHoles } = useRoundCalculationContext();
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, []);

  const allHoles = scorecard.teePlayed.holes ?? [];
  const playedHoles = allHoles.slice(0, scorecard.scores.length);

  return (
    <div
      ref={ref}
      className={cn(
        "bg-background rounded-lg border overflow-x-auto transition-all duration-500",
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      )}
    >
      <Table className="text-sm w-full">
        <TableHeader>
          <TableRow className="hover:bg-inherit">
            <TableHead className="py-2 px-4">Hole</TableHead>
            <TableHead className="py-2 px-4">Par</TableHead>
            <TableHead className="py-2 px-4">Strokes</TableHead>
            <TableHead className="py-2 px-4">HCP</TableHead>
            <TableHead className="py-2 px-4 flex flex-row items-center">
              Adj.{" "}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <InfoIcon className="h-4 w-4 text-muted-foreground ml-1" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Max: par + net double bogey (incl. handicap strokes)</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {allHoles.map((hole) => {
            const score = scorecard.scores[hole.holeNumber - 1];
            const isPlayed = !!score;

            return (
              <TableRow key={hole.id} className={!isPlayed ? "text-muted-foreground" : ""}>
                <TableCell className="py-2 px-4">{hole.holeNumber}</TableCell>
                <TableCell className="py-2 px-4">{isPlayed ? hole.par : "-"}</TableCell>
                <TableCell className="py-2 px-4">{isPlayed ? score.strokes : "-"}</TableCell>
                <TableCell className="py-2 px-4">{isPlayed ? score.hcpStrokes : "-"}</TableCell>
                <TableCell className="py-2 px-4">{isPlayed ? calculateHoleAdjustedScore(hole, score, hasEstablishedHandicap) : "-"}</TableCell>
              </TableRow>
            );
          })}
          <TableRow key={"total"} className="bg-secondary dark:bg-secondary font-medium">
            <TableCell className="py-2 px-4 first:rounded-l-lg rounded-tl-none! last:rounded-r-lg">
              {isNineHoles ? "Front 9" : "Total"}
            </TableCell>
            <TableCell className="py-2 px-4">
              {playedHoles.reduce((acc, hole) => acc + hole.par, 0)}
            </TableCell>
            <TableCell className="py-2 px-4">
              {playedHoles.reduce((acc, hole) => acc + (scorecard.scores[hole.holeNumber - 1]?.strokes ?? 0), 0)}
            </TableCell>
            <TableCell className="py-2 px-4">
              {playedHoles.reduce((acc, hole) => acc + (scorecard.scores[hole.holeNumber - 1]?.hcpStrokes ?? 0), 0)}
            </TableCell>
            <TableCell className="py-2 px-4 first:rounded-l-lg last:rounded-r-lg rounded-tr-none!">
              {playedHoles.reduce((acc, hole) => acc + calculateHoleAdjustedScore(hole, scorecard.scores[hole.holeNumber - 1], hasEstablishedHandicap), 0)}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
};

export default HolesTable;
