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
import { Hole, Tee } from "@/types/scorecard";
import { CONSTANTS, BREAKPOINTS } from "@/constants/golf";

interface ScorecardTableProps {
  selectedTee: Tee | undefined;
  displayedHoles: Hole[];
  holeCount: number;
  scores: number[];
  onScoreChange: (holeIndex: number, score: number) => void;
}

export function ScorecardTable({
  selectedTee,
  displayedHoles,
  holeCount,
  scores,
  onScoreChange,
}: ScorecardTableProps) {
  const calculateTotal = (scores: number[], start: number, end: number) =>
    scores.slice(start, end).reduce((sum, score) => sum + score, 0);

  return (
    <div
      className={`rounded-lg border max-w-[${BREAKPOINTS.TABLE_WIDTH.DEFAULT}] sm:max-w-[${BREAKPOINTS.TABLE_WIDTH.SM}] md:max-w-[${BREAKPOINTS.TABLE_WIDTH.MD}] lg:max-w-[${BREAKPOINTS.TABLE_WIDTH.LG}] xl:max-w-[${BREAKPOINTS.TABLE_WIDTH.XL}] 2xl:max-w-[${BREAKPOINTS.TABLE_WIDTH["2XL"]}] 3xl:max-w-[${BREAKPOINTS.TABLE_WIDTH["3XL"]}]`}
    >
      <div className="overflow-x-auto max-w-full">
        <Table className="w-full">
          <TableHeader>
            <TableRow>
              <TableHead className="bg-secondary dark:bg-accent text-primary-foreground dark:text-foreground w-20">
                HOLE
              </TableHead>
              {[...Array(holeCount)].map((_, i) => (
                <TableHead
                  key={i}
                  className="bg-secondary dark:bg-accent text-primary-foreground dark:text-foreground text-center min-w-[40px]"
                >
                  {i + 1}
                </TableHead>
              ))}
              {holeCount === CONSTANTS.EIGHTEEN_HOLES && (
                <>
                  <TableHead className="bg-secondary dark:bg-accent dark:text-foreground text-primary-foreground text-center min-w-[50px]">
                    OUT
                  </TableHead>
                  <TableHead className="bg-secondary dark:bg-accent dark:text-foreground text-primary-foreground text-center min-w-[50px]">
                    IN
                  </TableHead>
                </>
              )}
              <TableHead className="bg-secondary dark:bg-accent dark:text-foreground text-primary-foreground text-center min-w-[50px]">
                TOT
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* Distance Row */}
            <TableRow className="hover:bg-inherit">
              <TableCell className="font-medium bg-secondary dark:bg-accent truncate text-ellipsis whitespace-nowrap">
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
              <TableCell className="font-medium bg-secondary dark:bg-accent">
                PAR
              </TableCell>
              {displayedHoles.map((hole, i) => (
                <TableCell
                  key={i}
                  className="text-center bg-background-alternate dark:bg-bar"
                >
                  {hole.par}
                </TableCell>
              ))}
              {holeCount === CONSTANTS.EIGHTEEN_HOLES && (
                <>
                  <TableCell className="text-center font-medium bg-background-alternate dark:bg-bar">
                    {selectedTee?.outPar}
                  </TableCell>
                  <TableCell className="text-center font-medium bg-background-alternate dark:bg-bar">
                    {selectedTee?.inPar}
                  </TableCell>
                </>
              )}
              <TableCell className="text-center font-medium bg-background-alternate dark:bg-bar">
                {holeCount === CONSTANTS.EIGHTEEN_HOLES
                  ? selectedTee?.totalPar
                  : selectedTee?.outPar}
              </TableCell>
            </TableRow>

            {/* Handicap Row */}
            <TableRow className="hover:bg-inherit">
              <TableCell className="font-medium bg-secondary dark:bg-accent">
                HANDICAP
              </TableCell>
              {displayedHoles.map((hole, i) => (
                <TableCell key={i} className="text-center">
                  {hole.hcp}
                </TableCell>
              ))}
              {holeCount === CONSTANTS.EIGHTEEN_HOLES ? (
                <TableCell className="bg-background" colSpan={2} />
              ) : (
                <TableCell className="bg-background" />
              )}
              <TableCell className="bg-background" />
            </TableRow>

            {/* Score Row */}
            <TableRow className="hover:bg-inherit">
              <TableCell className="font-medium bg-secondary dark:bg-accent truncate text-ellipsis whitespace-nowrap">
                SCORE
              </TableCell>
              {scores.slice(0, holeCount).map((score, i) => (
                <TableCell
                  key={i}
                  className="p-2 bg-background-alternate dark:bg-bar"
                >
                  <Input
                    className="border-0 h-full text-center w-full"
                    type="number"
                    value={score || ""}
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
                  />
                </TableCell>
              ))}
              {holeCount === CONSTANTS.EIGHTEEN_HOLES && (
                <>
                  <TableCell className="text-center bg-background-alternate dark:bg-bar">
                    {calculateTotal(scores, 0, CONSTANTS.NINE_HOLES)}
                  </TableCell>
                  <TableCell className="text-center bg-background-alternate dark:bg-bar">
                    {calculateTotal(
                      scores,
                      CONSTANTS.NINE_HOLES,
                      CONSTANTS.EIGHTEEN_HOLES
                    )}
                  </TableCell>
                </>
              )}
              <TableCell className="text-center bg-background-alternate dark:bg-bar">
                {calculateTotal(scores, 0, holeCount)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
