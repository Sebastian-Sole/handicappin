import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { Input } from "../ui/input";
import { toast } from "../ui/use-toast";
import { Hole, Score, Tee } from "@/types/scorecard";
import { CONSTANTS } from "@/constants/golf";
import { Skeleton } from "../ui/skeleton";

interface ScorecardTableProps {
  selectedTee: Tee | undefined;
  displayedHoles: Hole[];
  holeCount: number;
  scores: Score[];
  onScoreChange: (holeIndex: number, score: number) => void;
}

export function ScorecardTable({
  selectedTee,
  displayedHoles,
  holeCount,
  scores,
  onScoreChange,
}: ScorecardTableProps) {
  const calculateTotal = (scores: Score[], start: number, end: number) =>
    scores.slice(start, end).reduce((sum, score) => sum + score.strokes, 0);

  return (
    <div
      className={`rounded-lg border overflow-hidden max-w-[270px] sm:max-w-[350px] md:max-w-[600px] lg:max-w-[725px] xl:max-w-[975px] 2xl:max-w-[1225px] 3xl:max-w-[1325px]`}
    >
      <div className="overflow-x-auto max-w-full">
        <Table className="w-full">
          <TableHeader>
            <TableRow>
              <TableHead className="bg-secondary dark:bg-muted dark:text-muted-foreground text-secondary-foreground w-20">
                HOLE
              </TableHead>
              {[...Array(holeCount)].map((_, i) => (
                <TableHead
                  key={i}
                  className="bg-secondary dark:bg-muted dark:text-muted-foreground text-secondary-foreground text-center min-w-[40px]"
                >
                  {i + 1}
                </TableHead>
              ))}
              {holeCount === CONSTANTS.EIGHTEEN_HOLES && (
                <>
                  <TableHead className="bg-secondary dark:bg-muted dark:text-muted-foreground text-secondary-foreground text-center min-w-[50px]">
                    OUT
                  </TableHead>
                  <TableHead className="bg-secondary dark:bg-muted dark:text-muted-foreground text-secondary-foreground text-center min-w-[50px]">
                    IN
                  </TableHead>
                </>
              )}
              <TableHead className="bg-secondary dark:bg-muted dark:text-muted-foreground text-secondary-foreground text-center min-w-[50px]">
                TOT
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* Distance Row */}
            <TableRow className="hover:bg-inherit">
              <TableCell className="font-medium bg-secondary dark:bg-muted dark:text-muted-foreground text-secondary-foreground truncate text-ellipsis whitespace-nowrap">
                {selectedTee?.name.toUpperCase()} TEE
              </TableCell>
              {displayedHoles.map((hole, i) => (
                <TableCell key={i} className="text-center">
                  {hole.distance}
                </TableCell>
              ))}
              {holeCount === CONSTANTS.EIGHTEEN_HOLES && (
                <>
                  <TableCell className="text-center font-medium bg-background">
                    {selectedTee?.outDistance}
                  </TableCell>
                  <TableCell className="text-center font-medium bg-background">
                    {selectedTee?.inDistance}
                  </TableCell>
                </>
              )}
              <TableCell className="text-center font-medium bg-background">
                {holeCount === CONSTANTS.EIGHTEEN_HOLES
                  ? selectedTee?.totalDistance
                  : selectedTee?.outDistance}
              </TableCell>
            </TableRow>

            {/* Par Row */}
            <TableRow className="hover:bg-inherit">
              <TableCell className="font-medium bg-secondary dark:bg-muted dark:text-muted-foreground text-secondary-foreground">
                PAR
              </TableCell>
              {displayedHoles.map((hole, i) => (
                <TableCell
                  key={i}
                  className="text-center bg-background-alternate"
                >
                  {hole.par}
                </TableCell>
              ))}
              {holeCount === CONSTANTS.EIGHTEEN_HOLES && (
                <>
                  <TableCell className="text-center font-medium bg-background-alternate">
                    {selectedTee?.outPar}
                  </TableCell>
                  <TableCell className="text-center font-medium bg-background-alternate">
                    {selectedTee?.inPar}
                  </TableCell>
                </>
              )}
              <TableCell className="text-center font-medium bg-background-alternate">
                {holeCount === CONSTANTS.EIGHTEEN_HOLES
                  ? selectedTee?.totalPar
                  : selectedTee?.outPar}
              </TableCell>
            </TableRow>

            {/* Handicap Row */}
            <TableRow className="hover:bg-inherit">
              <TableCell className="font-medium bg-secondary dark:bg-muted dark:text-muted-foreground text-secondary-foreground">
                HANDICAP
              </TableCell>
              {displayedHoles.map((hole, i) => (
                <TableCell key={i} className="text-center">
                  {hole.hcp}
                </TableCell>
              ))}
              {holeCount === CONSTANTS.EIGHTEEN_HOLES ? (
                <>
                  <TableCell className="bg-background" colSpan={2} />
                  <TableCell className="bg-background" />
                </>
              ) : (
                <TableCell className="bg-background" />
              )}
            </TableRow>

            {/* Score Row */}
            <TableRow className="hover:bg-inherit">
              <TableCell className="font-medium bg-secondary dark:bg-muted dark:text-muted-foreground text-secondary-foreground truncate text-ellipsis whitespace-nowrap">
                SCORE
              </TableCell>
              {scores.slice(0, holeCount).map((score, i) => (
                <TableCell key={i} className="p-2 bg-background-alternate">
                  <Input
                    className="border border-border h-full text-center w-full"
                    type="number"
                    value={score.strokes || ""}
                    onChange={(e) => {
                      if (e.target.value.length > CONSTANTS.MAX_SCORE_LENGTH) {
                        return;
                      }
                      let parsed = parseInt(e.target.value) || 0;
                      if (parsed < CONSTANTS.MIN_SCORE) {
                        parsed = CONSTANTS.MIN_SCORE;
                        toast({
                          title: "Invalid score",
                          description: "Score cannot be negative",
                          variant: "destructive",
                        });
                      }
                      onScoreChange(i, parsed);
                    }}
                    onWheel={(e) => {
                      e.currentTarget.blur();
                    }}
                  />
                </TableCell>
              ))}
              {holeCount === CONSTANTS.EIGHTEEN_HOLES && (
                <>
                  <TableCell className="text-center bg-background-alternate">
                    {calculateTotal(scores, 0, CONSTANTS.NINE_HOLES)}
                  </TableCell>
                  <TableCell className="text-center bg-background-alternate">
                    {calculateTotal(
                      scores,
                      CONSTANTS.NINE_HOLES,
                      CONSTANTS.EIGHTEEN_HOLES
                    )}
                  </TableCell>
                </>
              )}
              <TableCell className="text-center bg-background-alternate">
                {calculateTotal(scores, 0, holeCount)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export const TableSkeleton = ({ holeCount }: { holeCount: number }) => {
  return (
    <Skeleton
      className={`rounded-lg border min-w-[270px] sm:min-w-[350px] md:min-w-[600px] lg:min-w-[725px] xl:min-w-[975px] 2xl:min-w-[1225px] 3xl:min-w-[1600px]`}
    >
      <div className="overflow-x-auto max-w-full">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="p-2 bg-secondary w-20">
                <Skeleton className="h-6 w-12" />
              </th>
              {[...Array(holeCount)].map((_, i) => (
                <th key={i} className="p-2 bg-secondary text-center">
                  <Skeleton className="h-6 w-8" />
                </th>
              ))}
              {holeCount === 18 && (
                <>
                  <th className="p-2 bg-secondary text-center">
                    <Skeleton className="h-6 w-10" />
                  </th>
                  <th className="p-2 bg-secondary text-center">
                    <Skeleton className="h-6 w-10" />
                  </th>
                </>
              )}
              <th className="p-2 bg-secondary text-center">
                <Skeleton className="h-6 w-10" />
              </th>
            </tr>
          </thead>
          <tbody>
            {/* Distance Row */}
            <tr>
              <td className="p-2 bg-secondary">
                <Skeleton className="h-6 w-24" />
              </td>
              {[...Array(holeCount)].map((_, i) => (
                <td key={i} className="p-2 text-center">
                  <Skeleton className="h-6 w-10" />
                </td>
              ))}
              {holeCount === 18 && (
                <>
                  <td className="p-2 text-center">
                    <Skeleton className="h-6 w-12" />
                  </td>
                  <td className="p-2 text-center">
                    <Skeleton className="h-6 w-12" />
                  </td>
                </>
              )}
              <td className="p-2 text-center">
                <Skeleton className="h-6 w-12" />
              </td>
            </tr>

            {/* Par Row */}
            <tr>
              <td className="p-2 bg-secondary">
                <Skeleton className="h-6 w-10" />
              </td>
              {[...Array(holeCount)].map((_, i) => (
                <td key={i} className="p-2 text-center">
                  <Skeleton className="h-6 w-10" />
                </td>
              ))}
              {holeCount === 18 && (
                <>
                  <td className="p-2 text-center">
                    <Skeleton className="h-6 w-12" />
                  </td>
                  <td className="p-2 text-center">
                    <Skeleton className="h-6 w-12" />
                  </td>
                </>
              )}
              <td className="p-2 text-center">
                <Skeleton className="h-6 w-12" />
              </td>
            </tr>

            {/* Handicap Row */}
            <tr>
              <td className="p-2 bg-secondary">
                <Skeleton className="h-6 w-14" />
              </td>
              {[...Array(holeCount)].map((_, i) => (
                <td key={i} className="p-2 text-center">
                  <Skeleton className="h-6 w-8" />
                </td>
              ))}
              {holeCount === 18 ? (
                <>
                  <Skeleton className="h-6 w-12" />
                  <Skeleton className="h-6 w-12" />
                </>
              ) : (
                <Skeleton className="h-6 w-12" />
              )}
            </tr>

            {/* Score Row */}
            <tr>
              <td className="p-2 bg-secondary">
                <Skeleton className="h-6 w-14" />
              </td>
              {[...Array(holeCount)].map((_, i) => (
                <td key={i} className="p-2">
                  <Skeleton className="h-10 w-full" />
                </td>
              ))}
              {holeCount === 18 && (
                <>
                  <td className="p-2 text-center">
                    <Skeleton className="h-6 w-12" />
                  </td>
                  <td className="p-2 text-center">
                    <Skeleton className="h-6 w-12" />
                  </td>
                </>
              )}
              <td className="p-2 text-center">
                <Skeleton className="h-6 w-12" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </Skeleton>
  );
};
