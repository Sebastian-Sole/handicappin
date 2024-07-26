import { calculateHoleAdjustedScore } from "@/utils/calculations/handicap";
import { InfoIcon } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";
import { Tables } from "@/types/supabase";

interface HolesTableProps {
  holes: Tables<"Hole">[];
}

const HolesTable = ({ holes }: HolesTableProps) => {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Hole</TableHead>
          <TableHead>Par</TableHead>
          <TableHead>Strokes</TableHead>
          <TableHead className="flex flex-row items-center">
            Adjusted Score{" "}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  {" "}
                  <InfoIcon className="h-6 w-6 text-gray-500 dark:text-gray-400 ml-4" />{" "}
                </TooltipTrigger>
                <TooltipContent>
                  <p>Par + net double bogey (incl. handicap)</p>
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
              <TableCell>{calculateHoleAdjustedScore(hole)}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
};

export default HolesTable;
