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
  const { holes } = useRoundCalculationContext();

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
          {holes.map((hole) => {
            return (
              <TableRow key={hole.id}>
                <TableCell>{hole.holeNumber}</TableCell>
                <TableCell>{hole.par}</TableCell>
                <TableCell>{hole.strokes}</TableCell>
                <TableCell>{hole.hcpStrokes}</TableCell>
                <TableCell>{calculateHoleAdjustedScore(hole)}</TableCell>
              </TableRow>
            );
          })}
          <TableRow key={"total"} className="bg-secondary dark:bg-secondary">
            <TableCell className="first:rounded-l-lg !rounded-tl-none last:rounded-r-lg ">
              Total
            </TableCell>
            <TableCell>
              {holes.reduce((acc, hole) => {
                return acc + hole.par;
              }, 0)}
            </TableCell>
            <TableCell>
              {holes.reduce((acc, hole) => {
                return acc + hole.strokes;
              }, 0)}
            </TableCell>
            <TableCell>
              {holes.reduce((acc, hole) => {
                return acc + hole.hcpStrokes;
              }, 0)}
            </TableCell>
            <TableCell className="first:rounded-l-lg last:rounded-r-lg !rounded-tr-none ">
              {holes.reduce((acc, hole) => {
                return acc + calculateHoleAdjustedScore(hole);
              }, 0)}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
};

export default HolesTable;
