import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { H3, Muted, P } from "@/components/ui/typography";
import { useRoundCalculationContext } from "@/contexts/roundCalculationContext";

const AGSCalculationDisplay = () => {
  const {
    adjustedPlayedScore,
    setAdjustedPlayedScore,
    courseHandicapCalculation,
    setPar,
    par,
    isNineHoles,
    holesPlayed,
    adjustedGrossScoreCalculation,
  } = useRoundCalculationContext();
  return (
    <section className="space-y-4">
      <H3>Adjusted Gross Score</H3>
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div>
          <Label className="mr-2">Adjusted Played Score:</Label>
          <Input
            placeholder="Adjusted Played Score"
            value={adjustedPlayedScore !== 0 ? adjustedPlayedScore : ""}
            onChange={(e) => {
              try {
                setAdjustedPlayedScore(Number(e.target.value) || 0);
              } catch {
                setAdjustedPlayedScore(adjustedPlayedScore);
              }
            }}
          />
        </div>
        <div>
          <Label>Course Handicap</Label>
          <Input
            placeholder="Course Handicap"
            value={Math.round(courseHandicapCalculation)}
            readOnly
            disabled
          />
        </div>
        <div>
          <Label>Par (18 holes):</Label>
          <Input
            placeholder="Par (18 holes)"
            value={par !== 0 ? par : ""}
            onChange={(e) => {
              try {
                setPar(Number(e.target.value) || 0);
              } catch {
                setPar(par);
              }
            }}
          />
        </div>
        <div>
          <Label>Holes Played:</Label>
          <Input
            placeholder="Holes Played"
            value={isNineHoles ? 9 : 18}
            readOnly
            disabled
          />
        </div>
      </div>
      <div>
        <Muted>
          Adjusted Gross Score = Adjusted Played Score + Course Handicap + (Par
          &times; (18 - Holes Played) &#247; 18)
        </Muted>
        <div className="flex flex-row items-center mt-4">
          <P>Adjusted Gross Score =</P>
          <Muted className="mx-2">
            {adjustedPlayedScore} + {Math.round(courseHandicapCalculation)} + (
            {par} &times; (18 - {holesPlayed}) &#247; 18)
          </Muted>
          <P className="!mt-0">=</P>
          <u className="ml-2 text-primary font-bold">
            {adjustedGrossScoreCalculation}
          </u>
        </div>
      </div>
    </section>
  );
};

export default AGSCalculationDisplay;
