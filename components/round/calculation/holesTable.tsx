import { calculateHoleAdjustedScore, type Score } from "@handicappin/handicap-core";
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

  // Build a holeId -> score lookup so back-9 rounds (holeNumber 10..18) work the
  // same as front-9. Indexing scorecard.scores by holeNumber is broken: scores is
  // length 9 with indices 0..8, so back-9 lookups always returned undefined.
  const scoresByHoleId = new Map<number, Score>();
  for (const s of scorecard.scores) {
    if (s.holeId !== undefined) scoresByHoleId.set(s.holeId, s);
  }

  // Played holes are the ones with a matching score, regardless of which 9 was played.
  const playedHoles = allHoles.filter(
    (h) => h.id !== undefined && scoresByHoleId.has(h.id)
  );

  // Section is on the scorecard for new submissions; legacy rows fall back to "front".
  const nineHoleSection: "front" | "back" = scorecard.nineHoleSection ?? "front";
  const totalsLabel = isNineHoles
    ? nineHoleSection === "back"
      ? "Back 9"
      : "Front 9"
    : "Total";

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
            <TableHead className="py-sm px-md">Hole</TableHead>
            <TableHead className="py-sm px-md">Par</TableHead>
            <TableHead className="py-sm px-md">Strokes</TableHead>
            <TableHead className="py-sm px-md">HCP</TableHead>
            <TableHead className="py-sm px-md flex flex-row items-center">
              Adj.{" "}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <InfoIcon className="h-4 w-4 text-muted-foreground ml-xs" />
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
            const score = hole.id !== undefined ? scoresByHoleId.get(hole.id) : undefined;
            const isPlayed = !!score;

            return (
              <TableRow key={hole.id} className={!isPlayed ? "text-muted-foreground" : ""}>
                <TableCell className="py-sm px-md">{hole.holeNumber}</TableCell>
                <TableCell className="py-sm px-md">{isPlayed ? hole.par : "-"}</TableCell>
                <TableCell className="py-sm px-md">{isPlayed ? score.strokes : "-"}</TableCell>
                <TableCell className="py-sm px-md">{isPlayed ? score.hcpStrokes : "-"}</TableCell>
                <TableCell className="py-sm px-md">{isPlayed ? calculateHoleAdjustedScore(hole, score, hasEstablishedHandicap) : "-"}</TableCell>
              </TableRow>
            );
          })}
          <TableRow key={"total"} className="bg-secondary dark:bg-secondary font-medium">
            <TableCell className="py-sm px-md first:rounded-l-lg rounded-tl-none! last:rounded-r-lg">
              {totalsLabel}
            </TableCell>
            <TableCell className="py-sm px-md">
              {playedHoles.reduce((acc, hole) => acc + hole.par, 0)}
            </TableCell>
            <TableCell className="py-sm px-md">
              {playedHoles.reduce((acc, hole) => {
                const score = hole.id !== undefined ? scoresByHoleId.get(hole.id) : undefined;
                return acc + (score?.strokes ?? 0);
              }, 0)}
            </TableCell>
            <TableCell className="py-sm px-md">
              {playedHoles.reduce((acc, hole) => {
                const score = hole.id !== undefined ? scoresByHoleId.get(hole.id) : undefined;
                return acc + (score?.hcpStrokes ?? 0);
              }, 0)}
            </TableCell>
            <TableCell className="py-sm px-md first:rounded-l-lg last:rounded-r-lg rounded-tr-none!">
              {playedHoles.reduce((acc, hole) => {
                const score = hole.id !== undefined ? scoresByHoleId.get(hole.id) : undefined;
                return acc + (score ? calculateHoleAdjustedScore(hole, score, hasEstablishedHandicap) : 0);
              }, 0)}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
};

export default HolesTable;
