import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { H3, Muted, P, Large, Blockquote } from "@/components/ui/typography";
import { useRoundCalculationContext } from "@/contexts/roundCalculationContext";
import Link from "next/link";

const ScoreDiffCalculationDisplay = () => {
  const {
    adjustedGrossScoreCalculation,
    rating,
    setRating,
    slope,
    setSlope,
    scoreDifferentialCalculation,
    scorecard,
  } = useRoundCalculationContext();
  return (
    <section className="space-y-4">
      <H3>Score Differential</H3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <Label>Adjusted Gross Score:</Label>
          <Input
            placeholder="Adjusted Gross Score"
            value={adjustedGrossScoreCalculation}
            readOnly
            disabled
          />
        </div>
        <div>
          <Label>Course Rating:</Label>
          <Input
            placeholder="Course Rating"
            value={rating !== 0 ? rating : ""}
            type="number"
            onChange={(e) => setRating(Number.parseFloat(e.target.value) || 0)}
          />
        </div>
        <div>
          <Label>Slope:</Label>
          <Input
            placeholder="Slope"
            value={slope !== 0 ? slope : ""}
            onChange={(e) => setSlope(Number(e.target.value) || 0)}
          />
        </div>
      </div>

      <Muted>
        Score Differential = (Adjusted Gross Score - Course Rating) &times; 113
        &#247; Slope
      </Muted>

      <div className="flex flex-row items-center mt-4">
        <P>Score Differential =</P>
        <Muted className="mx-2">
          ({adjustedGrossScoreCalculation} - {rating}) &times; (113 &#247;{" "}
          {slope})
        </Muted>
        <P className="!mt-0">=</P>
        <u className="ml-2 text-primary font-bold">
          {Math.round(scoreDifferentialCalculation * 10) / 10}
        </u>
      </div>

      <Large>How did this affect my handicap?</Large>
      <p>
        Your handicap index at the time this round was registered:{" "}
        {scorecard.round.existingHandicapIndex}
      </p>
      <p>Your handicap index after this round: {scorecard.round.updatedHandicapIndex}</p>
      <Blockquote className="not-italic border-r-2 pr-2">
        Your handicap index adjusts if the round registered is one of your 8
        best rounds in your last 20 played. If you&apos;ve played less than 20
        rounds, there is a different calculation which can be viewed here:{" "}
        <Link
          href={
            "https://www.usga.org/handicapping/roh/Content/rules/5%202%20Calculation%20of%20a%20Handicap%20Index.htm"
          }
          target="_blank"
        >
          <Button className="p-0 h-0" variant="link">
            UGSA Handicap Rules
          </Button>
        </Link>
      </Blockquote>
    </section>
  );
};

export default ScoreDiffCalculationDisplay;
