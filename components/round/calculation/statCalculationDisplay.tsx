import { H3, Large, Muted } from "@/components/ui/typography";
import { useRoundCalculationContext } from "@/contexts/roundCalculationContext";

const StatCalculationDisplay = () => {
  const { round, holesPlayed, courseHcpStat, apsStat } =
    useRoundCalculationContext();

  return (
    <section className="space-y-4">
      <H3>Individual Statistic Calculations</H3>
      <div className="bg-background rounded-lg border p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Large>
            Course Handicap:{" "}
            {holesPlayed === 9
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
          <Large>Adjusted Gross Score: {round.adjustedGrossScore}</Large>
          <Muted>
            Your score adjusted for 18 holes, factoring in expected score for
            rounds with fewer than 18 holes played.
          </Muted>
        </div>
        <div>
          <Large>
            Score Differential: {Math.round(round.scoreDifferential * 10) / 10}
          </Large>
          <Muted>
            Your performance of the round in relation to the relative difficulty
            of the course that was played, i.e. the handicap you played to.
          </Muted>
        </div>
      </div>
    </section>
  );
};

export default StatCalculationDisplay;
