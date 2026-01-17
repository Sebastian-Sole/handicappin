import { useRef } from "react";
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
  disabled: boolean;
}

export function ScorecardTable({
  selectedTee,
  displayedHoles,
  holeCount,
  scores,
  onScoreChange,
  disabled,
}: ScorecardTableProps) {
  const desktopInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const mobileInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const calculateTotal = (scores: Score[], start: number, end: number) =>
    scores.slice(start, end).reduce((sum, score) => sum + score.strokes, 0);

  const handleScoreInput = (
    e: React.ChangeEvent<HTMLInputElement>,
    holeIndex: number,
    inputRefs: React.MutableRefObject<(HTMLInputElement | null)[]>,
    totalHoles: number
  ) => {
    const value = e.target.value;

    if (value.length > CONSTANTS.MAX_SCORE_LENGTH) {
      return;
    }

    let parsed = parseInt(value) || 0;
    if (parsed < CONSTANTS.MIN_SCORE) {
      parsed = CONSTANTS.MIN_SCORE;
      toast({
        title: "Invalid score",
        description: "Score cannot be negative",
        variant: "destructive",
      });
    }

    onScoreChange(holeIndex, parsed);

    // Auto-advance logic:
    // - If single digit 2-9, advance immediately (scores 20+ are rare in golf)
    // - If 1, wait for second digit (10-19 is more common than hole-in-one)
    // - If two digits entered, advance (max score length reached)
    const shouldAutoAdvance =
      (value.length === 1 && parsed >= 2 && parsed <= 9) || value.length === 2;

    if (shouldAutoAdvance && holeIndex < totalHoles - 1) {
      const nextInput = inputRefs.current[holeIndex + 1];
      if (nextInput) {
        nextInput.focus();
        nextInput.select();
      }
    }
  };

  return (
    <>
      {/* Desktop Table - Hidden on viewports < 1024px */}
      <div className="hidden xl:block w-full rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <Table className="w-full">
            <TableHeader>
              <TableRow>
                <TableHead className="bg-accent dark:bg-muted text-secondary-foreground dark:text-primary-foreground w-20">
                  HOLE
                </TableHead>
                {[...Array(holeCount)].map((_, i) => (
                  <TableHead
                    key={i}
                    className="bg-accent dark:bg-muted text-secondary-foreground dark:text-primary-foreground text-center min-w-[40px]"
                  >
                    {i + 1}
                  </TableHead>
                ))}
                {holeCount === CONSTANTS.EIGHTEEN_HOLES && (
                  <>
                    <TableHead className="bg-accent dark:bg-muted text-secondary-foreground dark:text-primary-foreground text-center min-w-[50px]">
                      OUT
                    </TableHead>
                    <TableHead className="bg-accent dark:bg-muted text-secondary-foreground dark:text-primary-foreground text-center min-w-[50px]">
                      IN
                    </TableHead>
                  </>
                )}
                <TableHead className="bg-accent dark:bg-muted text-secondary-foreground dark:text-primary-foreground text-center min-w-[50px]">
                  TOT
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* Distance Row */}
              <TableRow className="hover:bg-inherit">
                <TableCell className="font-medium bg-accent dark:bg-muted text-secondary-foreground dark:text-primary-foreground truncate text-ellipsis whitespace-nowrap">
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
                <TableCell className="font-medium bg-accent dark:bg-muted text-secondary-foreground dark:text-primary-foreground">
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
                <TableCell className="font-medium bg-accent dark:bg-muted text-secondary-foreground dark:text-primary-foreground">
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
                <TableCell className="font-medium bg-accent dark:bg-muted text-secondary-foreground dark:text-primary-foreground truncate text-ellipsis whitespace-nowrap">
                  SCORE
                </TableCell>
                {scores.slice(0, holeCount).map((score, i) => (
                  <TableCell key={i} className="p-2 bg-background-alternate">
                    <Input
                      ref={(el) => {
                        desktopInputRefs.current[i] = el;
                      }}
                      className="border border-border h-full text-center w-full"
                      type="number"
                      value={score.strokes || ""}
                      disabled={disabled}
                      onChange={(e) =>
                        handleScoreInput(e, i, desktopInputRefs, holeCount)
                      }
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

      {/* Mobile Table - Visible on viewports < 1024px */}
      <div className="block xl:hidden w-full space-y-3">
        {/* Tee Info - Above table */}
        <div className="rounded-lg bg-accent dark:bg-muted p-3 border">
          <div className="text-sm font-medium text-secondary-foreground dark:text-primary-foreground mb-2">
            {selectedTee?.name.toUpperCase()} TEE
          </div>
          <div className="flex w-full md:justify-start md:gap-8 justify-between gap-2 text-sm">
            <div className="flex justify-start gap-2">
              <span className="text-secondary-foreground dark:text-primary-foreground">
                Total Distance:
              </span>
              <span className="font-medium">
                {holeCount === CONSTANTS.EIGHTEEN_HOLES
                  ? selectedTee?.totalDistance
                  : selectedTee?.outDistance}
              </span>
            </div>
            <div className="flex justify-end gap-2">
              <span className="text-secondary-foreground dark:text-primary-foreground">
                Total Par:
              </span>
              <span className="font-medium">
                {holeCount === CONSTANTS.EIGHTEEN_HOLES
                  ? selectedTee?.totalPar
                  : selectedTee?.outPar}
              </span>
            </div>
          </div>
        </div>

        {/* Score table */}
        <div className="rounded-lg border overflow-hidden">
          <div className="overflow-y-auto">
            <Table className="w-full">
              <TableHeader>
                <TableRow>
                  <TableHead className="bg-accent dark:bg-muted text-secondary-foreground dark:text-primary-foreground text-center w-16">
                    HOLE
                  </TableHead>
                  <TableHead className="bg-accent dark:bg-muted text-secondary-foreground dark:text-primary-foreground text-center w-16">
                    PAR
                  </TableHead>
                  <TableHead className="bg-accent dark:bg-muted text-secondary-foreground dark:text-primary-foreground text-center w-16">
                    HCP
                  </TableHead>
                  <TableHead className="bg-accent dark:bg-muted text-secondary-foreground dark:text-primary-foreground text-center w-24">
                    SCORE
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayedHoles.map((hole, i) => (
                  <TableRow key={i} className="hover:bg-inherit">
                    <TableCell className="text-center font-medium bg-accent dark:bg-muted text-secondary-foreground dark:text-primary-foreground">
                      {i + 1}
                    </TableCell>
                    <TableCell className="text-center bg-background-alternate">
                      {hole.par}
                    </TableCell>
                    <TableCell className="text-center bg-background">
                      {hole.hcp}
                    </TableCell>
                    <TableCell className="p-2 bg-background-alternate w-24">
                      <Input
                        ref={(el) => {
                          mobileInputRefs.current[i] = el;
                        }}
                        className="border border-border h-12 text-center w-full text-lg"
                        type="number"
                        value={scores[i]?.strokes || ""}
                        disabled={disabled}
                        onChange={(e) =>
                          handleScoreInput(e, i, mobileInputRefs, holeCount)
                        }
                        onWheel={(e) => {
                          e.currentTarget.blur();
                        }}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Score Summary - Below table */}
        <div className="rounded-lg border bg-background p-3">
          <div className="text-sm font-medium mb-2">Score Summary</div>
          {holeCount === CONSTANTS.EIGHTEEN_HOLES ? (
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded bg-background-alternate p-2">
                <div className="text-xs text-muted-foreground mb-1">OUT</div>
                <div className="text-lg font-bold">
                  {calculateTotal(scores, 0, CONSTANTS.NINE_HOLES)}
                </div>
                <div className="text-xs text-muted-foreground">
                  Par {selectedTee?.outPar}
                </div>
              </div>
              <div className="rounded bg-background-alternate p-2">
                <div className="text-xs text-muted-foreground mb-1">IN</div>
                <div className="text-lg font-bold">
                  {calculateTotal(
                    scores,
                    CONSTANTS.NINE_HOLES,
                    CONSTANTS.EIGHTEEN_HOLES
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  Par {selectedTee?.inPar}
                </div>
              </div>
              <div className="rounded bg-primary/10 p-2">
                <div className="text-xs text-muted-foreground mb-1">TOTAL</div>
                <div className="text-lg font-bold text-primary">
                  {calculateTotal(scores, 0, holeCount)}
                </div>
                <div className="text-xs text-muted-foreground">
                  Par {selectedTee?.totalPar}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex justify-center">
              <div className="rounded bg-primary/10 p-3 min-w-[120px] text-center">
                <div className="text-xs text-muted-foreground mb-1">TOTAL</div>
                <div className="text-2xl font-bold text-primary">
                  {calculateTotal(scores, 0, holeCount)}
                </div>
                <div className="text-xs text-muted-foreground">
                  Par {selectedTee?.outPar}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
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
