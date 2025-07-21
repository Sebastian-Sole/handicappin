import { calculateHoleAdjustedScore } from "@/utils/calculations/handicap";
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

const HolesTable = () => {
  const { scorecard } = useRoundCalculationContext();

  return (
    <div className="bg-background rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-inherit ">
            <TableHead>Hole</TableHead>
            <TableHead>Par</TableHead>
            <TableHead>Strokes</TableHead>
            <TableHead>HCP Strokes</TableHead>
            <TableHead className="flex flex-row items-center">
              Adjusted Score{" "}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    {" "}
                    <InfoIcon
                      className={`h-6 w-6 text-muted-foreground ml-4`}
                    />{" "}
                  </TooltipTrigger>
                  <TooltipContent>
                    {" "}
                    <p>Max: par + net double bogey (incl. handicap strokes)</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {scorecard.teePlayed.holes?.slice(0, scorecard.scores.length).map((hole) => {
            return (
              <TableRow key={hole.id}>
                <TableCell>{hole.holeNumber}</TableCell>
                <TableCell>{hole.par}</TableCell>
                <TableCell>{scorecard.scores[hole.holeNumber - 1]?.strokes}</TableCell>
                <TableCell>{scorecard.scores[hole.holeNumber - 1]?.hcpStrokes}</TableCell>
                <TableCell>{calculateHoleAdjustedScore(hole, scorecard.scores[hole.holeNumber - 1])}</TableCell>
              </TableRow>
            );
          })}
          <TableRow key={"total"} className="bg-secondary dark:bg-secondary">
            <TableCell className="first:rounded-l-lg rounded-tl-none! last:rounded-r-lg ">
              Total
            </TableCell>
            <TableCell>
              {scorecard.teePlayed.holes?.slice(0, scorecard.scores.length).reduce((acc, hole) => {
                return acc + hole.par;
              }, 0)}
            </TableCell>
            <TableCell>
              {scorecard.teePlayed.holes?.slice(0, scorecard.scores.length).reduce((acc, hole) => {
                return acc + scorecard.scores[hole.holeNumber - 1]?.strokes;
              }, 0)}
            </TableCell>
            <TableCell>
              {scorecard.teePlayed.holes?.slice(0, scorecard.scores.length).reduce((acc, hole) => {
                return acc + scorecard.scores[hole.holeNumber - 1]?.hcpStrokes;
              }, 0)}
            </TableCell>
            <TableCell className="first:rounded-l-lg last:rounded-r-lg rounded-tr-none! ">
              {scorecard.teePlayed.holes?.slice(0, scorecard.scores.length).reduce((acc, hole) => {
                return acc + calculateHoleAdjustedScore(hole, scorecard.scores[hole.holeNumber - 1]);
              }, 0)}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
};

export default HolesTable;
