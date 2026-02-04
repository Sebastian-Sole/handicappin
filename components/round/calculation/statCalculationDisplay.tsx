import { Button } from "@/components/ui/button";
import { H3, Large, Muted } from "@/components/ui/typography";
import { useRoundCalculationContext } from "@/contexts/roundCalculationContext";
import Link from "next/link";

const StatCalculationDisplay = () => {
  const { scorecard, numberOfHolesPlayed, courseHcpStat, apsStat } =
    useRoundCalculationContext();

  return (
    <section className="space-y-4">
      <H3>Individual Statistic Calculations</H3>
      <div className="bg-background rounded-lg border p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Large>
            Course Handicap:{" "}
            {numberOfHolesPlayed === 9
              ? Math.round(courseHcpStat / 2)
              : Math.round(courseHcpStat)}
          </Large>
          <Muted>Additional handicap strokes you received this round</Muted>
        </div>
        <div>
          <Large>Adjusted Played Score: {apsStat}</Large>
          <Muted>
            Your played score adjusted such that every hole maxes out at par +
            net bogey (incl. hcp)
          </Muted>
        </div>
        <div>
          <Large>
            Adjusted Gross Score: {scorecard.round.adjustedGrossScore}
          </Large>
          <Muted>
            Your score adjusted for 18 holes, factoring in expected score for
            rounds with fewer than 18 holes played.
          </Muted>
        </div>
        <div>
          <Large>
            Score Differential:{" "}
            {Math.round(scorecard.round.scoreDifferential * 10) / 10}
          </Large>
          <Muted>
            Your performance of the round in relation to the relative difficulty
            of the course that was played, i.e. the handicap you played to.
          </Muted>
        </div>
        {scorecard.round.exceptionalScoreAdjustment !== 0 && (
          <div>
            <Large>
              ✨ Exceptional Score Adjustment:{" "}
              {scorecard.round.exceptionalScoreAdjustment} ✨
            </Large>
            <Muted>
              This round was under the threshold for an exceptional round, and
              therefore will more positively impact your handicap. For more
              information on how this is calculated, click{" "}
              <Link
                href={
                  "https://www.usga.org/content/usga/home-page/handicapping/world-handicap-system/topics/exceptional-score-reduction.html"
                }
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant={"link"} className="p-0 items-start">
                  here
                </Button>
              </Link>
            </Muted>
          </div>
        )}
      </div>
    </section>
  );
};

export default StatCalculationDisplay;
